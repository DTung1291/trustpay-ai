# Architecture

```
Browser (React + Vite)
  pages/            Dashboard, CreateAgreement, AgreementDetail, VerificationResults
  components/       Header, Gate (contract/wallet/network checks), MilestoneCard, TxPanel, ui
  hooks/            useWallet, useContract, useTransactions, useAsync
  lib/
    genlayer.ts     genlayer-js clients (read client, wallet-backed write client), Studionet config
    contract.ts     the only file that knows contract method names and argument order
    normalize.ts    contract response -> typed objects (rejects unknown enum values)
    tx.ts           transaction status -> UI phase, polling loop
    validation.ts   input checks that mirror the contract rules
    stats.ts        dashboard figures derived from contract reads
        |
        v  genlayer-js (JSON-RPC + wallet signing)
GenLayer Studionet
  TrustPay verification Intelligent Contract (see docs/trustpay-contract-spec.md)
```

## Data flow

Reads: pages call `lib/contract.ts`, which calls `readContract`. Results pass through `normalize.ts`. Nothing is cached or invented, and every dashboard figure is computed from those reads.

Writes: a page calls `useTransactions().run({ key, label, send })`. `send` signs through the wallet and returns a hash. The hook then polls the transaction and shows the real phase: signing, pending, consensus, accepted (appeal window open), finalized, or failed. A contract error, an undetermined consensus, a cancel, a timeout, or a validator timeout all show as failed. Pages refresh their data when a transaction is first accepted and again when it finalizes.

Duplicate submissions: `run` ignores a second call with the same key while the first is in flight, and buttons disable while busy. The contract is also specified to reject a second verification while one is running.

## Trust boundaries

- The contract is the authority for roles, state transitions, and the decision. Client-side validation is a convenience.
- Model output is shown as plain text, never as HTML or markdown.
- Evidence links open with `rel="noopener noreferrer nofollow"`.
- The app holds no keys. All signing happens in the user's wallet.

## Project layout note

The Arc Studio project keeps the Vite app at the repository root, so the "frontend" code lives in `src/` (pages, components, hooks, lib) rather than a `frontend/` folder.
