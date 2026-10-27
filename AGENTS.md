# TrustPay AI

> Built with Arc Studio

Project memory for future agents and humans.

## What This App Does

TrustPay AI is a GenLayer-native milestone verification app. Clients and freelancers agree on acceptance criteria, the freelancer submits public evidence, and a GenLayer Intelligent Contract returns an APPROVED, REJECTED, or INCONCLUSIVE verdict. No funds are held.

## Status

- Web app: implemented (`src/`).
- Python Intelligent Contract: not written. Spec in `docs/trustpay-contract-spec.md`, call surface in `docs/frontend-contract-interface.md`.
- Nothing deployed. No live verification has run.
- No contract address is recorded yet. Record it here once deployed.

## Tech Stack

- React 18, Vite, TypeScript, Tailwind, Framer Motion, React Router
- genlayer-js 1.1.8 against GenLayer Studionet (chain ID 61999), chain object from `genlayer-js/chains`
- Wallet: injected browser wallet (no wagmi use in the app, though `src/main.tsx` still mounts the scaffold's providers)
- The Arc scaffold's Solidity files under `contracts/` are unused

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
- Python contract source is not written by Arc Studio; keep contract changes in the spec.

## To Run

```bash
bun install
bun run dev
bun run test:frontend
bun run check
```
