# Studionet deployment evidence

This record links the deployable source in `contracts/trustpay_verification.py` to a complete, independently validated workflow on GenLayer Studionet.

## Deployment

- Network: GenLayer Studionet, chain ID 61999
- Contract address: [`0x570945847102A400FD76A4842394Fc23aDb8635a`](https://explorer-studio.genlayer.com/address/0x570945847102A400FD76A4842394Fc23aDb8635a)
- Deployment transaction: [`0x05d08b5d8628e6d51703a4821dfac845648e190c9556412644fe4b8c9e77cd4f`](https://explorer-studio.genlayer.com/tx/0x05d08b5d8628e6d51703a4821dfac845648e190c9556412644fe4b8c9e77cd4f)
- Transaction status: `FINALIZED`
- Consensus result: `Accepted`
- Exposed interface: 5 read methods and 4 write methods

## Complete live workflow

Agreement `1`, milestone `0`, verification round `1` was executed in this order:

1. Client created the agreement: [`0xebe34c6957ce1e44584dbaa808d8f78244d3a1a9f8b52b5f5265b4e62e473a17`](https://explorer-studio.genlayer.com/tx/0xebe34c6957ce1e44584dbaa808d8f78244d3a1a9f8b52b5f5265b4e62e473a17) — `FINALIZED`.
2. Named freelancer accepted it: [`0xe20d26a28b761c93c2bd55d54976dd1c3d5b5e2d4ad9a66c0498cad6db07edc5`](https://explorer-studio.genlayer.com/tx/0xe20d26a28b761c93c2bd55d54976dd1c3d5b5e2d4ad9a66c0498cad6db07edc5) — `FINALIZED`.
3. Freelancer submitted immutable GitHub evidence: [`0x5a85785ab63ba4519631f5f40f291b09268de3ff84b8112cfffa9aaad843ef37`](https://explorer-studio.genlayer.com/tx/0x5a85785ab63ba4519631f5f40f291b09268de3ff84b8112cfffa9aaad843ef37) — `FINALIZED`.
4. Freelancer requested validator verification: [`0x2b4e7c1b332ad16d454bdb29ea0bdd6951eb44db048b92cf08b58e07f4f74936`](https://explorer-studio.genlayer.com/tx/0x2b4e7c1b332ad16d454bdb29ea0bdd6951eb44db048b92cf08b58e07f4f74936) — `FINALIZED`, consensus `Accepted`.

Evidence evaluated by validators:

- URL: [`README.md` at commit `4f39ae31...`](https://raw.githubusercontent.com/DTung1291/trustpay-ai/4f39ae31a630123831c352825014f0f3931a4742/README.md)
- Commit SHA: `4f39ae31a630123831c352825014f0f3931a4742`
- Criterion: the README identifies TrustPay AI and describes GenLayer milestone verification.

## Stored verification result

The accepted-state call `get_verification(1, 0, 1)` returned:

```json
{
  "outcome": "APPROVED",
  "round": 1,
  "evidence_commit_sha": "4f39ae31a630123831c352825014f0f3931a4742",
  "criteria_results": [
    {
      "criterion_index": 0,
      "met": true,
      "reason": "README title is TrustPay AI: Intelligent Milestone Verification and it describes requesting AI-assisted verdicts from a GenLayer Intelligent Contract for milestone verification."
    }
  ],
  "summary": "The README publicly identifies the project as TrustPay AI: Intelligent Milestone Verification and describes GenLayer-based milestone verification via an AI-assisted verdict from a GenLayer Intelligent Contract."
}
```

This demonstrates more than deployment: it records the agreement state machine, role-gated writes, external evidence retrieval, structured AI evaluation, independent validator execution, consensus acceptance, and a persisted `APPROVED` verdict.
