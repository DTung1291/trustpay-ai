# Deployment

TrustPay AI has two parts: the Intelligent Contract and the web app. Nothing has been deployed from this repository yet.

## Contract status

The contract source (`contracts/trustpay_verification.py`) is not in this repository. The behavior it must implement is in `docs/trustpay-contract-spec.md`, and the exact call surface the web app uses is in `docs/frontend-contract-interface.md`.

Until a contract implementing that interface is deployed and its address is configured, the web app shows a setup screen and performs no contract calls.

## Deploy the contract to Studionet (external GenLayer environment)

Use the GenLayer tooling described at https://docs.genlayer.com/developers/intelligent-contracts/tooling-setup.

1. Install the CLI: `npm install -g genlayer`
2. Select the network: `genlayer network set` and choose Studionet. Studionet uses chain ID 61999 and RPC `https://studio.genlayer.com/api`.
3. Deploy: `genlayer deploy --contract contracts/trustpay_verification.py`
4. Copy the deployed contract address.

You can also deploy from the hosted Studio at https://studio.genlayer.com.

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
