# TrustPay AI: Intelligent Milestone Verification

A web app for freelancers and clients to agree on acceptance criteria, submit public evidence of delivery, and request an AI-assisted verdict from a GenLayer Intelligent Contract. It records decisions only. It does not hold or move funds.

Built with [Arc Studio](https://studio.arc.io)

## Status

Read this first.

- The web app is implemented and talks to GenLayer Studionet through genlayer-js.
- The deployable Python Intelligent Contract is in `contracts/trustpay_verification.py`. It fetches public GitHub evidence inside a nondeterministic block, asks the validator LLM for a strict per-criterion result, and uses `gl.vm.run_nondet_unsafe` so validators independently compare the leader's decisions before state is updated.
- The current Studionet deployment is finalized at [`0x4b86...4e34`](https://explorer-studio.genlayer.com/address/0x4b86090541DA283A0166B6767325DAfd56a04e34). Its [deployment transaction](https://explorer-studio.genlayer.com/tx/0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced) completed through full validator consensus.
- A live SHA-bound workflow is complete: create, accept, submit evidence, and [request verification](https://explorer-studio.genlayer.com/tx/0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23) all finalized. `get_verification(1, 0, 1)` returns `APPROVED` with the criterion marked `true` for `README.md` at commit `2ca6f57606d162f0bfafe81a9c74b9b0bf25d07b`.
- Local contract tests cover transitions, permissions, malformed output, and validator disagreement. The live transaction record and stored verdict are documented in `docs/deployment-evidence.md`.

## What you can do in the app

- Connect a browser wallet and switch it to GenLayer Studionet.
- Create an agreement with milestones and acceptance criteria.
- As the named freelancer, accept the agreement and submit an immutable GitHub file URL plus the matching full 40-character commit SHA.
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

- `VITE_TRUSTPAY_CONTRACT_ADDRESS`: address of the deployed contract. `.env.example` contains the current public Studionet deployment; it can also be replaced from the setup screen.

Other commands:

```bash
bun run build          # production build into dist/
bun run test:frontend  # unit tests for validation, parsing, transaction states, stats
bun run test:contract  # contract syntax, local state-machine and consensus-boundary tests
bun run test           # all local tests
bun run check          # lint and typecheck
```

## Repository layout

- `src/`: the web app (pages, components, hooks, lib). The Vite app sits at the repository root.
- `docs/`: contract specification, frontend/contract interface, architecture, security notes
- `contracts/contract-metadata/trustpay_verification.schema.json`: ABI/schema extracted by the official GenVM linter
- `deploy/`: deployment steps for the contract and app
- `examples/`: sample agreement and evidence cases
- `tests/frontend/`: frontend unit tests
- `tests/contract/`: local Intelligent Contract tests with a minimal GenLayer runtime stub

## Documentation

- `docs/handoff-package.md`: everything an external GenLayer developer needs to implement the contract
- `docs/trustpay-contract-spec.md`
- `docs/frontend-contract-interface.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/deployment-evidence.md`
- `deploy/README.md`

GenLayer docs: https://docs.genlayer.com/
