# Frontend / contract interface

This is the exact call surface the frontend (`src/lib/contract.ts`) uses. It is implemented by `contracts/trustpay_verification.py`.

All view methods return JSON-compatible values. Addresses are `0x` hex strings. Timestamps are unix seconds.

## Writes (sent with `writeContract`)

| Method | Arguments | Notes |
|---|---|---|
| `create_agreement` | `title: str`, `description: str`, `freelancer: Address`, `milestones_json: str` | `milestones_json` is a JSON array of `{"title": str, "criteria": [str, ...]}` |
| `accept_agreement` | `agreement_id: int` | Named freelancer only |
| `submit_deliverable` | `agreement_id: int`, `milestone_index: int`, `evidence_url: str`, `commit_sha: str` | Empty string means no commit SHA |
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
