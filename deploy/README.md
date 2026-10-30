# Deployment

TrustPay AI has two parts: the Intelligent Contract and the web app. The current contract is deployed on Studionet and has completed a live milestone-verification workflow with an `APPROVED` verdict.

## Contract status

The contract source is `contracts/trustpay_verification.py`. It implements the complete interface in `docs/frontend-contract-interface.md`, including the leader/validator consensus workflow. Until it is deployed and configured, the web app shows a setup screen and performs no contract calls.

## Validate before deployment

```bash
bun run test:contract
```

This always runs Python syntax checks and local contract tests. Install the official linter with `pip install genvm-linter`; when `genvm-lint` is available, the same command also validates the pinned GenVM contract schema and ABI. Do not publish an address until `genvm-lint` and a Studio deployment both succeed.

The expected ABI/schema is checked in at `contracts/contract-metadata/trustpay_verification.schema.json`. Regenerate and compare it with the official linter when `genvm-lint` is installed:

```bash
genvm-lint schema contracts/trustpay_verification.py \
  --output contracts/contract-metadata/trustpay_verification.schema.json
```

## Deploy the contract to Studionet (external GenLayer environment)

Use the GenLayer tooling described at https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup.

1. Install the current GenLayer CLI following the official documentation.
2. Select and inspect Studionet: `genlayer network set studionet` then `genlayer network info`. Studionet uses chain ID 61999.
3. Deploy: `genlayer deploy --contract contracts/trustpay_verification.py --rpc https://studio.genlayer.com/api`
4. Wait for finalization, confirm execution is `SUCCESS`, then copy both the deployment transaction hash and contract address.

You can also deploy from the hosted Studio at https://studio.genlayer.com.

## Live acceptance checklist

After deployment:

1. Call `get_agreement_count`; it must return `0` on a fresh deployment.
2. Configure the frontend with the address and create an agreement from the client account.
3. From the named freelancer account, accept it and submit an immutable GitHub file URL plus its matching full 40-character commit SHA.
4. Request verification and inspect the Studio transaction timeline. It must show validator votes and a finalized successful execution.
5. Call `get_verification(..., round=1)` and save the returned verdict plus the transaction hash as submission evidence.
6. Record the address and transaction hashes in the deployment record below.

## Deployment record

- Network: Studionet (chain ID 61999)
- Contract address: [`0x4b86090541DA283A0166B6767325DAfd56a04e34`](https://explorer-studio.genlayer.com/address/0x4b86090541DA283A0166B6767325DAfd56a04e34)
- Deployment transaction: [`0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced`](https://explorer-studio.genlayer.com/tx/0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced) — `FINALIZED`, consensus `Accepted`
- SHA-bound verification transaction: [`0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23`](https://explorer-studio.genlayer.com/tx/0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23) — `FINALIZED`, consensus `Accepted`, stored verdict `APPROVED`
- Evidence record: `docs/deployment-evidence.md`

## Point the web app at the contract

Either:
- set `VITE_TRUSTPAY_CONTRACT_ADDRESS` in `.env` and restart the dev server, or
- paste the address into the setup screen (stored in the browser's local storage).

## Wallet

Use a browser wallet that can connect to Studionet. The app asks the wallet to add and switch to the network through the genlayer-js `connect` helper. Fund the account with the Studio's built-in faucet.

## Bradbury Testnet (later)

Bradbury is the public testnet. Moving to it needs:
- redeploying the contract there,
- switching the chain in `src/lib/genlayer.ts` from `studionet` to `testnetBradbury`,
- a Bradbury GenLayer RPC endpoint (see https://docs.genlayer.com/developers/networks), and testnet GEN from its faucet.

This has not been attempted.

## Hosting the web app

`bun run build` produces a static `dist/`. Serve it with an SPA fallback so `/agreements/1` loads on a hard refresh.
