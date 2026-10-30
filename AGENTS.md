# TrustPay AI

> Built with Arc Studio

Project memory for future agents and humans.

## What This App Does

TrustPay AI is a GenLayer-native milestone verification app. Clients and freelancers agree on acceptance criteria, the freelancer submits public evidence, and a GenLayer Intelligent Contract returns an APPROVED, REJECTED, or INCONCLUSIVE verdict. No funds are held.

## Status

- Web app: implemented (`src/`).
- Python Intelligent Contract: implemented in `contracts/trustpay_verification.py` with web evidence retrieval, structured LLM evaluation, and independent validator comparison.
- Contract tests: `tests/contract/test_trustpay_contract.py` covers state transitions, access control, malformed model output, and validator disagreement.
- Studionet deployment: `0x4b86090541DA283A0166B6767325DAfd56a04e34`.
- Deployment transaction `0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced` is finalized. The SHA-bound workflow is finalized and `get_verification(1, 0, 1)` returns `APPROVED`; the verification transaction is `0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23`.

## Tech Stack

- React 18, Vite, TypeScript, Tailwind, Framer Motion, React Router
- genlayer-js 1.1.8 against GenLayer Studionet (chain ID 61999), chain object from `genlayer-js/chains`
- Wallet: injected browser wallet (no wagmi use in the app, though `src/main.tsx` still mounts the scaffold's providers)
- The Arc scaffold's Solidity helper files under `contracts/` are unrelated to the GenLayer contract.

## Key Files

- `src/lib/contract.ts`: only place that names contract methods
- `src/lib/tx.ts`: transaction status to UI phase and polling
- `src/lib/genlayer.ts`: clients, network, contract address config (`VITE_TRUSTPAY_CONTRACT_ADDRESS` or local storage)
- `src/hooks/`: wallet, contract address, transactions, async loading
- `src/pages/`: Dashboard, CreateAgreement, AgreementDetail, VerificationResults
- `tests/frontend/lib.test.ts`: `bun run test:frontend`

## Rules

- Never fabricate transaction results or dashboard data. Everything comes from contract reads.
- Contract text is rendered as plain text only.
- Keep the Python contract, frontend interface, tests, and deployment guide in sync.

## To Run

```bash
bun install
bun run dev
bun run test:frontend
bun run test:contract
bun run check
```
