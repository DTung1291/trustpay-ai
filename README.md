# TrustPay AI: Intelligent Milestone Verification

A web app for freelancers and clients to agree on acceptance criteria, submit public evidence of delivery, and request an AI-assisted verdict from a GenLayer Intelligent Contract. It records decisions only. It does not hold or move funds.

Built with [Arc Studio](https://studio.arc.io)

## Status

Read this first.

- The web app is implemented and talks to GenLayer Studionet through genlayer-js.
- The deployable Python Intelligent Contract is in `contracts/trustpay_verification.py`. It fetches public GitHub evidence inside a nondeterministic block, asks the validator LLM for a strict per-criterion result, and uses `gl.vm.run_nondet_unsafe` so validators independently compare the leader's decisions before state is updated.
- The current Studionet deployment is finalized at [`0x5709...635a`](https://explorer-studio.genlayer.com/address/0x570945847102A400FD76A4842394Fc23aDb8635a). Its [deployment transaction](https://explorer-studio.genlayer.com/tx/0x05d08b5d8628e6d51703a4821dfac845648e190c9556412644fe4b8c9e77cd4f) completed through full validator consensus.
- A live end-to-end workflow is complete: create, accept, submit evidence, and [request verification](https://explorer-studio.genlayer.com/tx/0x2b4e7c1b332ad16d454bdb29ea0bdd6951eb44db048b92cf08b58e07f4f74936) all finalized. `get_verification(1, 0, 1)` returns `APPROVED` with the criterion marked `true` for the immutable README at commit `4f39ae31a630123831c352825014f0f3931a4742`.
- Local contract tests cover transitions, permissions, malformed output, and validator disagreement. The live transaction record and stored verdict are documented in `docs/deployment-evidence.md`.

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
