# Security considerations

This covers the web app. Contract-side requirements are in `docs/trustpay-contract-spec.md` (sections 7 to 12). None of the contract protections exist until the contract is written, deployed, and tested.

## Web app

- No private keys, API keys, or secrets are used. Signing happens in the wallet.
- Contract addresses are public values. `VITE_TRUSTPAY_CONTRACT_ADDRESS` is safe to expose.
- All contract and model text (titles, summaries, reasons, URLs) renders through React text nodes, so it cannot inject markup.
- External links use `target="_blank"` with `rel="noopener noreferrer nofollow"`.
- Evidence URL checks before sending: https only, no credentials, no whitespace, length cap. These are advisory. The contract must enforce its own checks.
- Contract responses with unknown status or outcome values are rejected instead of guessed.

## Known limits

- The app cannot know whether a deployed contract really implements the spec. Review the contract before trusting its decisions.
- Prompt-injection resistance is a contract concern. The spec describes the approach and its residual risk.
- The app reads the newest accepted state, which can still change during the appeal window. The transaction panel shows when a transaction is finalized.
- Verification transaction details are shown only for transactions started in the current browser session. Older ones are in the explorer.
- Studionet is a development network. Do not treat its results as production-grade.
