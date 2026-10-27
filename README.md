# TrustPay AI: Intelligent Milestone Verification

A web app for freelancers and clients to agree on acceptance criteria, submit public evidence of delivery, and request an AI-assisted verdict from a GenLayer Intelligent Contract. It records decisions only. It does not hold or move funds.

Built with [Arc Studio](https://studio.arc.io)

## Status

Read this first.

- The web app is implemented and talks to GenLayer Studionet through genlayer-js.
- The Python Intelligent Contract is NOT in this repository yet. Its required behavior is in `docs/trustpay-contract-spec.md` and the exact call surface the app expects is in `docs/frontend-contract-interface.md`.
- Nothing has been deployed, and no verification has run against a live network. Without a configured contract address the app shows a setup screen and makes no contract calls.
- The unit tests cover the web app's pure logic only. There are no contract tests or integration tests yet.

## What you can do in the app

- Connect a browser wallet and switch it to GenLayer Studionet.
- Create an agreement with milestones and acceptance criteria.
- As the named freelancer, accept the agreement and submit evidence (https URL, optional commit SHA).
- As client or freelancer, request verification and follow the transaction through consensus.
- Read the verdict, per-criterion results, and reasoning stored by the contract.
- See a dashboard of your agreements, built only from contract reads.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Lucide React, genlayer-js, React Router.

## Development

Prerequisites: [Bun](https://bun.sh) and a browser wallet.

```bash
bun install
bun run dev
```

Environment variables (see `.env.example`):

- `VITE_TRUSTPAY_CONTRACT_ADDRESS`: address of the deployed contract. Optional. If empty, paste the address into the setup screen.

Other commands:

```bash
bun run build          # production build into dist/
bun run test:frontend  # unit tests for validation, parsing, transaction states, stats
bun run check          # lint and typecheck
```

## Repository layout

- `src/`: the web app (pages, components, hooks, lib). The Vite app sits at the repository root.
- `docs/`: contract specification, frontend/contract interface, architecture, security notes
- `deploy/`: deployment steps for the contract and app
- `examples/`: sample agreement and evidence cases
- `tests/frontend/`: unit tests

## Documentation

- `docs/handoff-package.md`: everything an external GenLayer developer needs to implement the contract
- `docs/trustpay-contract-spec.md`
- `docs/frontend-contract-interface.md`
- `docs/architecture.md`
- `docs/security.md`
- `deploy/README.md`

GenLayer docs: https://docs.genlayer.com/
