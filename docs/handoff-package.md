# TrustPay AI: GenLayer contract handoff package

For the external GenLayer developer who will implement `contracts/trustpay_verification.py`. The goal is a contract that works with the existing frontend unchanged.

Read this first
- Nothing in this package was run against a live network. No contract exists, none is deployed, and no transaction has been sent. Everything about on-chain behavior comes from GenLayer documentation. Section 9 lists what is unverified.
- Sections 1 to 3 are copied verbatim from the repository files (`docs/trustpay-contract-spec.md`, `docs/frontend-contract-interface.md`, `src/lib/contract.ts`). If they ever differ from the repository, the repository wins.
- Sections 4 to 9 were written for this handoff. Where they refine the spec, this document is the more recent source, and the spec has been updated to match (the VERIFYING marker and failed-consensus rows).

Contents
1. Contract specification
2. Frontend/contract interface
3. Current `src/lib/contract.ts`
4. Every contract method the frontend calls
5. State models, authorization, transitions
6. Verification rounds, duplicate and concurrent requests
7. AI result schema and consensus requirements
8. Connecting a deployed contract on Studionet
9. Unresolved assumptions
10. Sources

---

## 1. Contract specification (`docs/trustpay-contract-spec.md`)

````markdown
# TrustPay AI: Intelligent Contract Specification

Status: implemented and verified. The deployable contract is `contracts/trustpay_verification.py`; local tests pass, and the Studionet workflow recorded in `docs/deployment-evidence.md` finalized with an `APPROVED` consensus result.

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
- `submissions`: list of `{url, commit_sha (required full SHA), submitted_by, submitted_at, round}`
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

- `evidence_url`: must be a `github.com/.../blob/<sha>/<path>` or `raw.githubusercontent.com/.../<sha>/<path>` file URL. Mutable pages and refs are rejected.
- `commit_sha`: required, exactly 40 hexadecimal characters, and must match the URL ref.
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
````

---

## 2. Frontend/contract interface (`docs/frontend-contract-interface.md`)

````markdown
# Frontend / contract interface

This is the exact call surface the frontend (`src/lib/contract.ts`) uses. A contract that implements `docs/trustpay-contract-spec.md` and returns these shapes works with the app unchanged. The contract itself is not part of this repository yet.

All view methods return JSON-compatible values. Addresses are `0x` hex strings. Timestamps are unix seconds.

## Writes (sent with `writeContract`)

| Method | Arguments | Notes |
|---|---|---|
| `create_agreement` | `title: str`, `description: str`, `freelancer: Address`, `milestones_json: str` | `milestones_json` is a JSON array of `{"title": str, "criteria": [str, ...]}` |
| `accept_agreement` | `agreement_id: int` | Named freelancer only |
| `submit_deliverable` | `agreement_id: int`, `milestone_index: int`, `evidence_url: str`, `commit_sha: str` | Immutable GitHub file URL and matching full SHA required |
| `request_verification` | `agreement_id: int`, `milestone_index: int` | Client or freelancer |

## Reads (sent with `readContract`)

| Method | Arguments | Returns |
|---|---|---|
| `get_agreement_count` | none | `int` |
| `get_agreement_ids_for` | `account: Address` | `list[int]` (agreements where the account is client or freelancer) |
| `get_agreement` | `agreement_id: int` | `{id, client, freelancer, title, description, status, created_at, accepted_at, milestone_count}` |
| `get_milestone` | `agreement_id: int`, `milestone_index: int` | `{index, title, criteria: [str], status, submissions: [{url, commit_sha, submitted_by, submitted_at, round}], rounds_used, max_rounds, verified_rounds}` |
| `get_verification` | `agreement_id: int`, `milestone_index: int`, `round: int` | `{round, outcome, summary, criteria_results: [{criterion_index, met, reason}], evidence_url, evidence_commit_sha, requested_by, requested_at, finalized_at}` |

Enumerations

- Agreement `status`: `PENDING_ACCEPTANCE`, `ACTIVE`, `COMPLETED`, `CANCELLED`
- Milestone `status`: `AWAITING_EVIDENCE`, `EVIDENCE_SUBMITTED`, `APPROVED`, `REJECTED`, `INCONCLUSIVE`. The frontend also accepts `VERIFYING` but a single-transaction verification never persists it.
- Verification `outcome`: `APPROVED`, `REJECTED`, `INCONCLUSIVE`
- Criterion `met`: `true`, `false`, or `"unclear"`

If the deployed contract differs, change only `src/lib/contract.ts`.
````

---

## 3. Current `src/lib/contract.ts`

```ts
import { TransactionHashVariant } from 'genlayer-js/types'
import { getReadClient, getWriteClient } from './genlayer'
import {
  parseAgreement,
  parseCount,
  parseIdList,
  parseMilestone,
  parseVerification,
} from './normalize'
import type { AgreementBundle, Milestone, Verification } from './types'

type Addr = `0x${string}`

async function read(address: string, functionName: string, args: (string | number | bigint)[] = []) {
  return getReadClient().readContract({
    address: address as Addr,
    functionName,
    args,
    // Show the newest accepted state. Finality is reported separately by the tx tracker.
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  })
}

// ---- Reads ---------------------------------------------------------------

export async function getAgreementCount(contract: string): Promise<number> {
  return parseCount(await read(contract, 'get_agreement_count'))
}

/** Confirm an address answers the interface the app needs. Returns the agreement count. */
export async function probeContract(contract: string): Promise<number> {
  try {
    return await getAgreementCount(contract)
  } catch {
    throw new Error(
      'This address did not answer get_agreement_count on Studionet. Check that the contract is deployed there and implements docs/frontend-contract-interface.md.',
    )
  }
}

export async function getAgreementIdsFor(contract: string, account: string): Promise<number[]> {
  return parseIdList(await read(contract, 'get_agreement_ids_for', [account]))
}

export async function getAgreement(contract: string, id: number) {
  return parseAgreement(await read(contract, 'get_agreement', [BigInt(id)]))
}

export async function getMilestone(contract: string, id: number, index: number): Promise<Milestone> {
  return parseMilestone(await read(contract, 'get_milestone', [BigInt(id), BigInt(index)]))
}

export async function getVerification(
  contract: string,
  id: number,
  index: number,
  round: number,
): Promise<Verification> {
  return parseVerification(
    await read(contract, 'get_verification', [BigInt(id), BigInt(index), BigInt(round)]),
  )
}

export async function getAgreementBundle(contract: string, id: number): Promise<AgreementBundle> {
  const agreement = await getAgreement(contract, id)
  const milestones = await Promise.all(
    Array.from({ length: agreement.milestoneCount }, (_, i) => getMilestone(contract, id, i)),
  )
  return { agreement, milestones }
}

export async function getVerificationHistory(
  contract: string,
  id: number,
  milestone: Milestone,
): Promise<Verification[]> {
  const rounds = Array.from({ length: milestone.verifiedRounds }, (_, i) => i + 1)
  return Promise.all(rounds.map((r) => getVerification(contract, id, milestone.index, r)))
}

/** Every agreement the account takes part in, with milestones. Failures are surfaced, not hidden. */
export async function getBundlesFor(contract: string, account: string): Promise<AgreementBundle[]> {
  const ids = await getAgreementIdsFor(contract, account)
  const bundles = await Promise.all(ids.map((id) => getAgreementBundle(contract, id)))
  return bundles.sort((a, b) => b.agreement.id - a.agreement.id)
}

// ---- Writes (return the transaction hash; tracking happens in tx.ts) ----------

async function write(
  contract: string,
  sender: string,
  functionName: string,
  args: (string | number | bigint)[],
): Promise<string> {
  const client = getWriteClient(sender)
  const hash: unknown = await client.writeContract({
    address: contract as Addr,
    functionName,
    args,
    value: 0n,
  })
  if (typeof hash !== 'string') throw new Error('The wallet did not return a transaction hash.')
  return hash
}

export const sendCreateAgreement = (
  contract: string,
  sender: string,
  p: { title: string; description: string; freelancer: string; milestonesJson: string },
) =>
  write(contract, sender, 'create_agreement', [
    p.title.trim(),
    p.description.trim(),
    p.freelancer.trim(),
    p.milestonesJson,
  ])

export const sendAcceptAgreement = (contract: string, sender: string, id: number) =>
  write(contract, sender, 'accept_agreement', [BigInt(id)])

export const sendSubmitDeliverable = (
  contract: string,
  sender: string,
  p: { id: number; index: number; url: string; commitSha: string },
) =>
  write(contract, sender, 'submit_deliverable', [
    BigInt(p.id),
    BigInt(p.index),
    p.url.trim(),
    p.commitSha.trim(),
  ])

export const sendRequestVerification = (contract: string, sender: string, id: number, index: number) =>
  write(contract, sender, 'request_verification', [BigInt(id), BigInt(index)])
```

---

## 4. Every contract method the frontend calls

All calls go through `src/lib/contract.ts` using genlayer-js 1.1.8. Integers are sent as JavaScript `bigint`. Strings are sent as plain strings. Reads use `readContract` with `transactionHashVariant: LATEST_NONFINAL` (newest accepted state, not necessarily final). Writes use `writeContract` with `value: 0n` and no `fees`, `leaderOnly`, `consensusMaxRotations`, or `validUntil`.

### 4.1 Writes

A write returns a transaction hash to the frontend. The frontend never reads a return value from a write, so a new agreement's id is discovered afterwards through `get_agreement_ids_for`.

| # | Method | Args in order | Types sent | Sender rule the frontend assumes | Frontend validation before sending |
|---|---|---|---|---|---|
| W1 | `create_agreement` | `title`, `description`, `freelancer`, `milestones_json` | str, str, str (0x hex), str (JSON) | any connected account becomes client | see 4.3 |
| W2 | `accept_agreement` | `agreement_id` | int | named freelancer only | none beyond UI gating |
| W3 | `submit_deliverable` | `agreement_id`, `milestone_index`, `evidence_url`, `commit_sha` | int, int, str, str | named freelancer only | URL and SHA checks in 4.3 |
| W4 | `request_verification` | `agreement_id`, `milestone_index` | int, int | client or freelancer | none beyond UI gating |

Notes
- `title`, `description`, `freelancer`, `evidence_url`, `commit_sha` are trimmed before sending. `commit_sha` is the empty string when the user gave none.
- `milestones_json` is `JSON.stringify` of `[{"title": str, "criteria": [str, ...]}, ...]`, with titles and criteria trimmed and empty criteria removed. Example: `[{"title":"Repository delivered","criteria":["README explains setup","LICENSE file present"]}]`.
- GenLayer docs show address parameters declared as `str` and converted inside the contract with `Address(...)`. Use that for `freelancer` and for `get_agreement_ids_for`. The docs do not show the JS SDK encoding an `Address` typed parameter from a hex string, so declaring these as `str` is the compatible choice.

### 4.2 Reads

| # | Method | Args | Returns | Used by |
|---|---|---|---|---|
| R1 | `get_agreement_count` | none | int | contract probe on the setup screen |
| R2 | `get_agreement_ids_for` | `account: str` (0x hex) | list of int | dashboard |
| R3 | `get_agreement` | `agreement_id: int` | object (below) | dashboard, detail page, results page |
| R4 | `get_milestone` | `agreement_id: int`, `milestone_index: int` | object (below) | detail page, results page |
| R5 | `get_verification` | `agreement_id: int`, `milestone_index: int`, `round: int` (1-based) | object (below) | results page |

R3 `get_agreement` object
```
{ id: int, client: str, freelancer: str, title: str, description: str,
  status: "PENDING_ACCEPTANCE"|"ACTIVE"|"COMPLETED"|"CANCELLED",
  created_at: int (unix s), accepted_at: int (unix s, 0 if not accepted),
  milestone_count: int }
```
R4 `get_milestone` object
```
{ index: int, title: str, criteria: [str],
  status: "AWAITING_EVIDENCE"|"EVIDENCE_SUBMITTED"|"APPROVED"|"REJECTED"|"INCONCLUSIVE"  (also tolerates "VERIFYING"),
  submissions: [{ url: str, commit_sha: str, submitted_by: str, submitted_at: int, round: int }],
  rounds_used: int, max_rounds: int, verified_rounds: int }
```
R5 `get_verification` object
```
{ round: int, outcome: "APPROVED"|"REJECTED"|"INCONCLUSIVE", summary: str,
  criteria_results: [{ criterion_index: int (0-based), met: true|false|"unclear", reason: str }],
  evidence_url: str, evidence_commit_sha: str,
  requested_by: str, requested_at: int, finalized_at: int }
```

Return type rules
- Address-valued fields must be returned as strings (`Address.as_hex`, EIP-55). The frontend compares them case-insensitively and displays them shortened.
- Enum fields must be exactly the uppercase strings above. The frontend throws on any other value and shows an error instead of guessing.
- `met` is a boolean for true/false and the string `"unclear"` otherwise. The parser also accepts the strings `"true"` and `"false"`.
- Missing numeric fields are read as 0 and missing string fields as the empty string. Missing enum fields throw.
- The frontend accepts a decoded dict as either a plain object or a `Map`, and integers as either `number` or `bigint`.

### 4.3 Frontend input limits (the contract must accept at least these)

| Field | Frontend limit |
|---|---|
| title | 1 to 120 chars |
| description | 1 to 2000 chars |
| freelancer | `0x` plus 40 hex chars, not equal to sender |
| milestones per agreement | 1 to 5 |
| milestone title | 1 to 120 chars |
| criteria per milestone | 1 to 10 |
| criterion text | 1 to 300 chars |
| evidence URL | at most 500 chars, starts with `https://`, no whitespace or control characters, no embedded credentials, host contains a dot |
| commit SHA | exactly 40 hex characters and equal to the URL ref |

The contract must enforce its own limits and should not be looser than needed. It must not be stricter than the table, or valid frontend input will be rejected.

### 4.4 Frontend error handling per call

Reads
- Any thrown error is shown in an error box with a Retry button. Pages that load several reads together (`get_agreement` + all `get_milestone`; `get_milestone` + all `get_verification`) fail as a whole if one read fails.
- R1 failure on the setup screen shows: "This address did not answer get_agreement_count on Studionet..." and the address is not saved.
- R2 returning something that is not a list is treated as an empty list without an error.
- R3/R4/R5 returning a non-object, or an unknown enum value, throws "Unexpected ... response from contract" or "Unknown ... returned by contract."

Writes
- Wallet signature rejection (code 4001 or a message containing "user rejected" or "denied"): "Signature rejected in your wallet."
- Any other send error: the error's short message.
- After a hash is returned, the frontend polls `getTransaction` every 2.5 s for up to 15 minutes and maps status to a phase:
  - PENDING: pending. PROPOSING, COMMITTING, REVEALING, APPEAL_COMMITTING, APPEAL_REVEALING: consensus.
  - ACCEPTED or READY_TO_FINALIZE: accepted (the page refreshes its data). FINALIZED: finalized (the page refreshes again).
  - UNDETERMINED, CANCELED, LEADER_TIMEOUT, VALIDATORS_TIMEOUT: failed with a fixed message.
  - Any of ACCEPTED, READY_TO_FINALIZE, FINALIZED combined with `txExecutionResultName == FINISHED_WITH_ERROR`: failed, shown as "The contract rejected this call (execution finished with an error)."
  - Timeout with no accepted state: failed with "Timed out waiting for the network."
- The contract's revert message text is NOT shown to the user. Revert messages are still useful for explorer debugging.
- A second write with the same action key (for example the same verification) is ignored while the first is in flight. The UI also hides the action button once the milestone status changes.

## 5. Required state models, authorization rules, and transitions

### 5.1 State models

Agreement: `id` (sequential from 0), `client` (Address), `freelancer` (Address), `title`, `description`, `status`, `created_at`, `accepted_at`, ordered milestones. Exposed as R3 plus per-milestone reads.

Milestone: `index` (0-based position), `title`, `criteria` (immutable list), `status`, `submissions` (append-only list), `rounds_used`, `max_rounds`, and an append-only list of Verification records addressed by round.

Verification: as R5. One record per verified submission, addressed by the submission's round number.

Per-participant index: a mapping from account to the list of agreement ids where the account is client or freelancer, to serve R2. Client and freelancer must never be the same account, so an id appears at most once per account.

Storage types and the nondeterministic-block rules are in the GenLayer docs (see 7.4). Storage writes must happen outside nondeterministic blocks.

### 5.2 Authorization

Determine the caller from `gl.message.sender_address` (documented in Transaction Context). Never accept a caller address as an argument.

| Action | Who | Required state |
|---|---|---|
| `create_agreement` | any account | inputs valid; freelancer is not the sender |
| `accept_agreement` | the named freelancer | agreement `PENDING_ACCEPTANCE` |
| `submit_deliverable` | the named freelancer | agreement `ACTIVE`; milestone `AWAITING_EVIDENCE`; `rounds_used < max_rounds` |
| `request_verification` | client or freelancer | agreement `ACTIVE`; milestone `EVIDENCE_SUBMITTED` |
| reads | anyone | none |

Anyone else must be rejected with a user error before any state change.

### 5.3 Immutability

After `accept_agreement` succeeds, no function may change `title`, `description`, `freelancer`, milestone titles, or criteria. The recommended approach is to have no function that writes them after creation. Before acceptance, the only allowed change is cancellation (optional, see U7). Do not add an owner, admin, proxy, or upgrade path (decision recorded in the spec).

### 5.4 Transitions

```
Agreement
  PENDING_ACCEPTANCE --accept (freelancer)--> ACTIVE
  PENDING_ACCEPTANCE --cancel (client, optional)--> CANCELLED
  ACTIVE --every milestone APPROVED--> COMPLETED

Milestone (status values the frontend recognizes)
  AWAITING_EVIDENCE --submit_deliverable--> EVIDENCE_SUBMITTED
  EVIDENCE_SUBMITTED --request_verification, outcome APPROVED--> APPROVED            (terminal)
  EVIDENCE_SUBMITTED --request_verification, outcome REJECTED or INCONCLUSIVE,
                        rounds_used <  max_rounds--> AWAITING_EVIDENCE
  EVIDENCE_SUBMITTED --request_verification, outcome REJECTED or INCONCLUSIVE,
                        rounds_used == max_rounds--> REJECTED or INCONCLUSIVE        (terminal, matches the outcome)
```

Required for frontend compatibility: after a non-final REJECTED or INCONCLUSIVE outcome the status must return to `AWAITING_EVIDENCE`, because the submit form only renders for that status. The dashboard's "Rejected" count counts milestones whose current status is REJECTED, so it only reflects final rejections. Treat that as accepted behavior unless the frontend is changed.

Any other transition must revert with a user error.

## 6. Verification rounds, duplicate and concurrent requests

### 6.1 Round tracking (proposed rule, consistent with the frontend)

- `max_rounds` is a contract constant. The proposed value is 3. The frontend reads `max_rounds` from `get_milestone`, so the number is not hard-coded in the UI, but the wording "three rounds" in the brief assumes 3.
- A round is created by a submission. `submit_deliverable` appends a submission with `round = rounds_used + 1` and then sets `rounds_used = rounds_used + 1`. It reverts if `rounds_used` is already `max_rounds`.
- `request_verification` verifies the latest submission (the one with `round == rounds_used`) and stores the Verification record under that round number. It then sets `verified_rounds` to that round number.
- Invariants the frontend relies on:
  - Verification records exist contiguously for rounds `1..verified_rounds`. The results page fetches every one of them with `get_verification(id, index, round)`.
  - `verified_rounds == rounds_used` after a verdict, and `verified_rounds == rounds_used - 1` while a submission awaits its verdict.
  - `get_verification` for a round with no record should revert. The frontend never asks for one.
- A request that fails (revert, undetermined, timeout) must not consume or advance a round. Only a stored verdict does, and rounds are consumed by submissions, not by verification attempts.
- When the last allowed round ends REJECTED or INCONCLUSIVE, the milestone becomes terminal. The agreement stays ACTIVE (see U7).

### 6.2 Preventing duplicate and concurrent verification

Facts from the GenLayer docs
- Transactions addressed to the same Intelligent Contract pass through the proposal and voting phases sequentially, so a later state change cannot overtake an earlier unresolved one.
- Storage writes must happen after the nondeterministic block, in the deterministic part of the same transaction.
- A transaction that ends undetermined does not modify contract state.

Required design
1. `request_verification` checks `milestone.status == EVIDENCE_SUBMITTED` (and the role and agreement checks) at the start of execution.
2. It runs the nondeterministic evaluation, then writes the Verification record and the next status in one deterministic step after consensus.
3. A second `request_verification` for the same milestone, whether sent by the other party or by the same user from another tab, runs after the first. It sees the new status and reverts.
4. A persisted "in progress" marker is not required, and the docs' execution model means it would not survive anyway. The frontend tolerates `VERIFYING` but does not need it.

Frontend side
- The action is keyed `verify:<agreement>:<milestone>`. While one is in flight the button is disabled and a repeat call is ignored.
- If a duplicate still reaches the chain from elsewhere, it ends as a contract error and the frontend shows the failed state.

Residual risk to test: two requests accepted into the queue before either finishes. The docs' sequencing statement says this is safe. Verify with a two-account test on Studionet.

## 7. AI verification result schema and consensus requirements

### 7.1 Model output schema (what the leader asks the model for)

The model returns JSON only, for example via `response_format='json'` as shown in the docs:

```
{
  "evidence_readable": true | false,
  "criteria_results": [
    { "criterion_index": 0, "met": true | false | "unclear", "reason": "short plain text" }
  ],
  "summary": "short plain text"
}
```

Validation of the model output inside the contract (deterministic, before use)
- `criteria_results` must contain exactly one entry per criterion, with unique `criterion_index` values covering `0..n-1`.
- `met` must be `true`, `false`, or `"unclear"`. Anything else is a malformed evaluation.
- `reason` and `summary` are strings, length-capped, and stripped of control characters.
- If the output is malformed after the allowed retries, the stored outcome is INCONCLUSIVE with a "malformed evaluation" summary. The preferred alternative, raising a user error so the transaction fails and the round is not consumed, is also compatible. Decide which (see U10).

### 7.2 Outcome derivation (done by the contract, not by the model)

- `evidence_readable == false`, empty or off-topic evidence: INCONCLUSIVE.
- Every criterion `met == true`: APPROVED.
- At least one `met == false`: REJECTED.
- Otherwise (some `"unclear"`, none `false`): INCONCLUSIVE.

The model never supplies the overall outcome. This keeps an injected "approve" instruction from changing the decision without also changing per-criterion results.

### 7.3 Stored Verification record

Map the validated result into R5: `round`, derived `outcome`, `summary`, `criteria_results`, the exact `evidence_url` and `evidence_commit_sha` that were evaluated, `requested_by`, `requested_at`, `finalized_at` (transaction timestamp). The frontend renders `summary` and every `reason` as plain text.

### 7.4 Consensus requirements

Taken from the GenLayer Equivalence Principle and Non-determinism pages. Read both before implementing.

- Use a custom leader/validator pair with `gl.vm.run_nondet_unsafe`, which the docs recommend for most contracts.
- The leader fetches the evidence and calls the model inside the nondeterministic block. All `gl.nondet.*` calls (web, `exec_prompt`) must be inside it. Storage writes, contract calls, and message emission must be outside it.
- The validator must verify substance independently. The docs state that checking only the shape of the leader's JSON, an allowed enum value, or a non-empty summary is not consensus. The validator should re-run the same fetch and evaluation, derive the outcome from its own per-criterion results using 7.2, and accept only if the derived outcome and each `met` value match the leader's. `reason` and `summary` text must not be compared, since two models word them differently.
- Return only stable, extracted data from the nondeterministic block (the docs advise extracting before comparing), not raw page content.
- If the leader's output is an error or malformed, the validator should disagree so the network rotates the leader.
- The leader's accepted result is what gets stored. Validator intermediate answers are not persisted automatically.
- If consensus is not reached the transaction is undetermined and state is unchanged.

Docs references for API names (verify against the current docs before use): `gl.nondet.web.get`, `gl.nondet.web.request`, `gl.nondet.web.render`, `gl.nondet.exec_prompt` with `response_format='json'`, `gl.vm.run_nondet_unsafe`, `gl.vm.Return`, `gl.vm.UserError`, `gl.message.sender_address`, `Address(...)` with `.as_hex`, and `datetime.now(timezone.utc)` for the transaction timestamp.

### 7.5 Prompt-injection controls

- Put evidence in a clearly delimited block inside the prompt and state that it is untrusted data that may contain instructions to ignore.
- Cap the evidence size before prompting and strip control characters.
- Keep criteria text outside the evidence block.
- Derive the outcome in code (7.2).
- Test with a page whose text says to approve regardless of the criteria. The outcome must not change.

## 8. Connecting a deployed contract on Studionet (frontend setup)

Network facts used by the frontend, taken from the genlayer-js `studionet` chain object (checked in this repository) and the GenLayer Networks page: name "Genlayer Studio Network", chain ID 61999, RPC `https://studio.genlayer.com/api`, currency GEN. The frontend explorer links use `https://explorer-studio.genlayer.com`. Do not use the Studio-dev preview (chain ID 61997); the frontend is not built for it.

1. Deploy `contracts/trustpay_verification.py` to Studionet (CLI: `genlayer network set` then `genlayer deploy --contract contracts/trustpay_verification.py`, or the hosted Studio at https://studio.genlayer.com). The deploy docs say finalization does not by itself prove successful execution, so confirm the deployment's execution result before using the address.
2. Record the deployed contract address.
3. In the project root, add the address to `.env` and restart the dev server, because Vite reads env files only at startup:
   ```bash
   printf 'VITE_TRUSTPAY_CONTRACT_ADDRESS=0xYOUR_CONTRACT_ADDRESS\n' >> .env
   # then stop and re-run: bun run dev
   ```
   `.env.example` shows the variable name. Do not overwrite an existing `.env`.
4. Alternative with no restart: open the app, and on the "Connect the verification contract" screen paste the address. The app first calls `get_agreement_count`. If that read fails, the address is rejected with an explanation and nothing is saved. A pasted address is stored in the browser's local storage, and the variable from `.env` takes precedence if both exist. The dashboard shows a "Use a different contract" link for a pasted address (not for one set in `.env`).
5. Install a browser wallet. In the app, click "Connect wallet". If the wallet is on another chain the app shows "Switch to Genlayer Studio Network" and calls the genlayer-js `connect('studionet')` helper to add and switch the network.
6. Fund the account with Studio's built-in faucet (its account selector, per the Networks page).
7. Smoke test with two accounts, A (client) and B (freelancer):
   1. A: New agreement with B as freelancer, one milestone, two criteria. Expect the transaction to reach Accepted/Finalized and the agreement to appear on A's dashboard.
   2. B: open the agreement, Accept. Expect status ACTIVE and "Criteria are locked."
   3. B: Submit evidence (immutable GitHub file URL and matching full SHA). Expect milestone EVIDENCE_SUBMITTED and a Round 1 entry in the evidence history.
   4. A or B: Request AI verification. Expect the transaction to move through consensus, then the milestone to show a verdict and a "View verification" link.
   5. Open the results page. Expect per-criterion results, the summary, and the evaluated evidence link.
   6. Negative checks: A (the client) tries to accept; a second verification request after a verdict; a fourth evidence submission after three rounds; an `http://` URL (blocked by the UI, and send it directly to confirm the contract rejects it too).
8. To change contract methods or shapes, edit only `src/lib/contract.ts` (method names, argument order) and `src/lib/normalize.ts` (field names). Run `bun run check` and `bun run test:frontend` afterwards.

## 9. Unresolved assumptions and unverified items

None of these are settled facts. Each needs the external developer's confirmation or a Studionet test.

| ID | Item |
|---|---|
| U1 | Fees. The GenLayer docs say that on fee-charging (Consensus v0.6) deployments every deploy and write must carry a fee distribution and fee value. The frontend sends no `fees`. It is unconfirmed whether stable Studionet is fee-charging. The installed genlayer-js is 1.1.8, which is older than the SDK the docs describe, and the fee estimation helpers shown in the docs were not checked in 1.1.8. If Studionet requires fees, the write path needs to be extended. |
| U2 | Decoded return shapes in genlayer-js 1.1.8 (object vs Map, number vs bigint, how a returned `Address` decodes). The frontend normalizer accepts both forms, but this was only unit tested with synthetic values, never against a live contract. Return addresses as strings. |
| U3 | The docs say the contract clock is pinned to the transaction datetime, not real time. Timestamps stored this way are valid for display but may lag wall-clock time. |
| U4 | Reads use `LATEST_NONFINAL`. How that variant behaves against Studionet for freshly accepted state was not verified live. |
| U5 | Revert messages are not shown by the frontend. Whether an `UserError` surfaces as `FINISHED_WITH_ERROR` in the `getTransaction` result in 1.1.8 (which the failure mapping depends on) was not verified live. |
| U6 | Passing `Address` typed parameters from JS. This package assumes `str` parameters converted inside the contract (the docs' own pattern). |
| U7 | Not specified by the brief or frontend: whether milestones must be completed in order (the frontend allows any order); the agreement status when a milestone ends terminally REJECTED or INCONCLUSIVE (the agreement stays ACTIVE and there is no failure state); the `cancel_agreement` function (the frontend has no cancel button, though it can display CANCELLED). |
| U8 | The round cap value. 3 is proposed; the frontend reads whatever `max_rounds` the contract returns. |
| U9 | Which web access call and render mode works best for GitHub pages and raw files, response size caps, and whether Studionet rate limits or blocks fetches. The docs show `get`, `request`, and `render` (modes `html` and `screenshot` appear in the docs examples). Not tested. |
| U10 | Malformed model output: store INCONCLUSIVE (consumes the round) versus fail the transaction (does not consume the round). The spec says INCONCLUSIVE. Either works with the frontend. |
| U11 | Storage and string size limits in GenVM for the stored summary, reasons, URLs, and submissions. Not checked. |
| U12 | Whether MetaMask-style wallets sign GenLayer transactions on Studionet with the flow in genlayer-js 1.1.8 (`createClient` with `account` address and `provider`, plus `connect('studionet')`). Not tested. |
| U13 | An accepted transaction can still be appealed during the appeal window. The frontend refreshes on Accepted and on Finalized, but does not warn if an appeal changes the outcome. |
| U14 | Time to finalize on Studionet is unknown. The frontend polling timeout is 15 minutes. |
| U15 | Resolved: the SHA-bound contract is deployed at `0x4b86090541DA283A0166B6767325DAfd56a04e34`; create, accept, immutable evidence submission, and verification writes finalized on Studionet, and `get_verification(1, 0, 1)` returned `APPROVED`. See `docs/deployment-evidence.md`. |

## 10. Sources

- https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle
- https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism
- https://docs.genlayer.com/developers/intelligent-contracts/deploying
- https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context
- https://docs.genlayer.com/developers/intelligent-contracts/types/address
- https://docs.genlayer.com/developers/intelligent-contracts/features/web-access
- https://docs.genlayer.com/developers/intelligent-contracts/features/calling-llms
- https://docs.genlayer.com/developers/intelligent-contracts/features/error-handling
- https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/accounts-and-addresses
- https://docs.genlayer.com/developers/networks
- https://docs.genlayer.com/developers/decentralized-applications/writing-data
- https://docs.genlayer.com/api-references/genlayer-js
