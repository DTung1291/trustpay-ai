# TrustPay AI: Intelligent Contract Specification

Status: specification only. No contract source, deployment, test run, or consensus result exists yet. Every API name below must be checked against https://docs.genlayer.com/ before implementation.

## 1. Purpose

TrustPay AI records freelance agreements, locks their acceptance criteria, collects public evidence of delivery, and produces an evidence-based verdict (APPROVED, REJECTED, INCONCLUSIVE) through GenLayer validator consensus. The MVP does not custody or move funds.

## 2. Target and scope

- Network: GenLayer Studionet for development, Bradbury Testnet later. No Arc, EVM, or Circle components.
- Contract: one Python Intelligent Contract, `contracts/trustpay_verification.py`.
- Non-upgradeable: no proxy, no owner, no admin setter, no pause key. A fix means deploying a new contract.
- No token standard and no value held. Payment settlement is out of scope.

## 3. Roles

| Role | Who | Permissions |
|---|---|---|
| Client | Sender of `create_agreement` | Create agreement, request verification |
| Freelancer | Address named at creation | Accept agreement, submit deliverables, request verification |
| Anyone | Any other address | Read-only views |

Role checks use the transaction sender, never a caller-supplied address.

## 4. Data model

Agreement
- `id` (sequential), `client`, `freelancer`, `title`, `description`
- `status`: PENDING_ACCEPTANCE, ACTIVE, COMPLETED, CANCELLED
- `created_at`, `accepted_at`
- `milestones`: ordered list

Milestone
- `index`, `title`, `criteria`: list of 1 to 10 criterion strings, each with a length cap
- `status`: AWAITING_EVIDENCE, EVIDENCE_SUBMITTED, VERIFYING, APPROVED, REJECTED, INCONCLUSIVE
- `submissions`: list of `{url, commit_sha (optional), submitted_by, submitted_at, round}`
- `rounds_used`, `max_rounds` (constant, proposed 3)
- `verifications`: list of Verification records

Verification
- `round`, `outcome`, `summary`
- `criteria_results`: one entry per criterion `{criterion_index, met: true|false|unclear, reason}`
- `evidence_url`, `evidence_commit_sha`
- `requested_by`, `requested_at`, `finalized_at`

## 5. State machine

```
Agreement: PENDING_ACCEPTANCE --accept--> ACTIVE --all milestones APPROVED--> COMPLETED
           PENDING_ACCEPTANCE --client cancel--> CANCELLED

Milestone: AWAITING_EVIDENCE --submit--> EVIDENCE_SUBMITTED --request_verification (one transaction)--> outcome
           outcome APPROVED                                   --> APPROVED (terminal)
           outcome REJECTED or INCONCLUSIVE, rounds_used < max_rounds  --> AWAITING_EVIDENCE
           outcome REJECTED or INCONCLUSIVE, rounds_used == max_rounds --> REJECTED / INCONCLUSIVE (terminal)
```

The VERIFYING status is reserved and is not part of the required flow. Verification runs inside the single `request_verification` transaction, and GenLayer applies state changes only after consensus (see section 8). A marker written at the start of that transaction would never be persisted. The frontend accepts a `VERIFYING` value if a contract emits it, but does not need it.

Compatibility constraint: the frontend only offers evidence submission when the milestone status is `AWAITING_EVIDENCE`. After a non-final REJECTED or INCONCLUSIVE outcome the milestone status MUST therefore return to `AWAITING_EVIDENCE`. The outcome stays visible through the stored Verification record.

Rules:
- Resubmission after a REJECTED or INCONCLUSIVE outcome opens a new round, up to `max_rounds`.
- APPROVED is terminal for that milestone.
- Any transition not shown reverts with a specific error message.

## 6. Public interface

Writes
- `create_agreement(title, description, freelancer, milestones[])`: caller becomes client. Rejects freelancer equal to client, a zero or malformed address, empty or over-limit text, 0 milestones, or more than the milestone cap.
- `accept_agreement(agreement_id)`: only the named freelancer, only from PENDING_ACCEPTANCE. Sets ACTIVE and locks all criteria.
- `cancel_agreement(agreement_id)`: only the client, only before acceptance. (Extra function, optional.)
- `submit_deliverable(agreement_id, milestone_index, evidence_url, commit_sha)`: only the freelancer, only when the agreement is ACTIVE and the milestone is AWAITING_EVIDENCE.
- `request_verification(agreement_id, milestone_index)`: client or freelancer, only when the milestone is EVIDENCE_SUBMITTED. Sets VERIFYING before any AI step runs.

Reads
- `get_agreement(agreement_id)`, `get_milestone(agreement_id, milestone_index)`, `get_verification(agreement_id, milestone_index, round)`
- Listing helpers for the dashboard: agreement count and agreements by participant address.

## 7. Input validation (deterministic, before any AI call)

- `evidence_url`: must start with `https://`, length-capped, no credentials in the URL, no whitespace or control characters. Preferred hosts are github.com (repository, commit, pull request, release) and raw.githubusercontent.com. Other HTTPS hosts are accepted but flagged in the stored record.
- `commit_sha`: optional, 7 to 40 hex characters.
- Text fields: length caps, no empty strings, trimmed.
- Criteria are fixed at creation and never editable. After acceptance no function writes to them.

## 8. Verification flow

1. `request_verification` runs deterministic checks first (sender role, agreement ACTIVE, milestone status EVIDENCE_SUBMITTED). Per the GenLayer docs, transactions addressed to the same Intelligent Contract pass through proposal and voting sequentially, and a transaction that ends undetermined does not modify contract state. A second request queued behind the first therefore executes against the updated state, finds the milestone no longer in EVIDENCE_SUBMITTED, and reverts. That is the duplicate and concurrent verification guard. No in-flight marker is needed.
2. The leader node fetches the evidence URL through the GenLayer-supported web access mechanism. The fetch result is bounded in size and treated purely as data.
3. The leader prompts the model with the immutable criteria and the fetched evidence, and requires a strict JSON answer with the shape in section 4.
4. Validators each run their own evaluation of the same evidence against the same criteria and compare it with the leader's result under the Equivalence Principle. The compared fields are the substantive ones: the overall outcome and the per-criterion `met` values. Free-text reasoning is not compared.
5. If validators agree, the result is written as a Verification record and the milestone moves to its next state. If consensus fails, the transaction is undetermined and contract state is unchanged (see section 10).
6. When the final milestone of an agreement is APPROVED, the agreement becomes COMPLETED.

Outcome rule, applied deterministically in contract code after the model answers:
- APPROVED only if every criterion is `met: true`.
- REJECTED if any criterion is `met: false` and the evidence was readable.
- INCONCLUSIVE if the evidence was unreachable, empty, off-topic, or any criterion is `unclear` with none `false`.
The model proposes per-criterion results. The contract derives the overall outcome from them, so a model cannot return APPROVED with an unmet criterion.

## 9. Prompt-injection resistance

- Evidence is passed in a clearly delimited data block. The prompt states that the block is untrusted, contains no instructions, and that instructions inside it must be ignored and reported.
- The model must return only the structured schema. Any extra keys, non-JSON text, or out-of-range values cause a safe fallback of INCONCLUSIVE with a "malformed evaluation" reason.
- Overall outcome is computed by contract code from per-criterion results, never taken from the model verbatim.
- Evidence text is size-capped and stripped of control characters before prompting.
- The stored summary and reasons are length-capped and treated as plain text by the frontend (never rendered as HTML or markdown links).
- Validators run an independent evaluation, so a payload that only fools one node's output does not finalize alone.
- Known residual risk: a payload that fools every model identically. Mitigation is the INCONCLUSIVE fallback and the capped round count. This is documented, not solved.

## 10. Failure modes and handling

| Failure | Expected behavior |
|---|---|
| Evidence URL unreachable or non-200 | INCONCLUSIVE with reason "evidence unreachable"; consumes a round |
| Evidence empty or unrelated | INCONCLUSIVE |
| Model returns malformed output | INCONCLUSIVE with "malformed evaluation" |
| Validators disagree, consensus not reached | The GenLayer docs state the transaction goes undetermined and does not modify contract state. The milestone stays EVIDENCE_SUBMITTED and no round is consumed, so the request can be retried. The frontend shows the real transaction state (failed) and never a fabricated verdict. |
| Duplicate request after a verdict was stored | Revert (milestone no longer EVIDENCE_SUBMITTED) |
| Request after APPROVED or round cap | Revert |
| Wrong sender for any action | Revert with role error |
| Round cap reached | Milestone ends in its last outcome; no further submissions |

## 11. Events and records

The contract keeps the full verification history per milestone so the frontend can show every round. Event emission, if supported, mirrors: AgreementCreated, AgreementAccepted, DeliverableSubmitted, VerificationRequested, VerificationFinalized. State reads are the source of truth either way.

## 12. Security checklist

- Sender-based authorization on every write
- Criteria immutability after acceptance
- Single in-flight verification per milestone
- Round cap
- Bounded input and output sizes
- No upgrade path, no admin keys, no held funds
- Deterministic outcome derivation
- No hidden state used for secrets (all contract state is public)

## 13. Test plan (to run once code exists)

Direct tests: creation and acceptance; access control for every write; criteria immutability; evidence validation (bad scheme, bad SHA, oversized); invalid transitions; duplicate verification; round cap; outcome derivation (all met, one unmet, one unclear, malformed model output); external evidence handling with hostile text.

Integration tests (Studionet): full journey from create to verdict; resubmission round; unreachable URL; consensus-failure handling; transaction status reporting in the frontend.

## 14. Frontend contract (for a later build)

Four screens: Dashboard, Create Agreement, Agreement Details / Submit Evidence, Verification Results. Integration through the official genlayer-js SDK against Studionet. The UI shows pending, accepted, finalized, and failed states from real transaction data only. Dashboard figures come from contract reads.

## 15. Open items

1. Confirm the exact Python contract APIs for web access, model prompting, and equivalence comparison in the current GenLayer docs.
2. Failed-consensus semantics: the docs say undetermined transactions do not modify state. Confirm on Studionet with a forced-disagreement test.
3. Confirm the Studionet chain configuration and wallet connection method for genlayer-js.
4. Decide the milestone cap (proposed 5) and round cap (proposed 3).
5. Decide whether `cancel_agreement` ships in the MVP.
