# Studionet deployment evidence

This record links the deployable source in `contracts/trustpay_verification.py` to a complete, independently validated workflow on GenLayer Studionet.

## Deployment

- Network: GenLayer Studionet, chain ID 61999
- Contract address: [`0x4b86090541DA283A0166B6767325DAfd56a04e34`](https://explorer-studio.genlayer.com/address/0x4b86090541DA283A0166B6767325DAfd56a04e34)
- Deployment transaction: [`0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced`](https://explorer-studio.genlayer.com/tx/0x09c30b6b83b7550828992ed6dcc94fccec76bceb56498fdc0f036ddd2f1faced)
- Transaction status: `FINALIZED`
- Consensus result: `Accepted`
- Exposed interface: 5 read methods and 4 write methods

## Complete live workflow

Agreement `1`, milestone `0`, verification round `1` was executed in this order:

1. Client created the agreement: [`0x06346beb53cf19b3c7d35dadad947b54c8efe0df7d6fa0e1b17339abbb4d4ece`](https://explorer-studio.genlayer.com/tx/0x06346beb53cf19b3c7d35dadad947b54c8efe0df7d6fa0e1b17339abbb4d4ece) — `FINALIZED`, GenVM `SUCCESS`.
2. Named freelancer accepted it: [`0x6456ac7b6bb3df930c02d93d7c1b4ec161f8489f2b6f44bb19bd7f3a7971ad75`](https://explorer-studio.genlayer.com/tx/0x6456ac7b6bb3df930c02d93d7c1b4ec161f8489f2b6f44bb19bd7f3a7971ad75) — `FINALIZED`, GenVM `SUCCESS`.
3. Freelancer submitted immutable GitHub evidence: [`0xcb71ca972d3fe1684e5ac39666c99bd520d70472fa5a0636d2dccf9fb6a62ece`](https://explorer-studio.genlayer.com/tx/0xcb71ca972d3fe1684e5ac39666c99bd520d70472fa5a0636d2dccf9fb6a62ece) — `FINALIZED`, GenVM `SUCCESS`.
4. Freelancer requested validator verification: [`0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23`](https://explorer-studio.genlayer.com/tx/0xd017db396b810458f8a2f75cc654754bfe0d7a5f35b12ceef6ad3c50cc9a5e23) — `FINALIZED`, GenVM `SUCCESS`, consensus `Accepted`.

Evidence evaluated by validators:

- URL: [`README.md` at commit `2ca6f576...`](https://github.com/DTung1291/trustpay-ai/blob/2ca6f57606d162f0bfafe81a9c74b9b0bf25d07b/README.md)
- Commit SHA: `2ca6f57606d162f0bfafe81a9c74b9b0bf25d07b`
- Criterion: the README instructs freelancers to submit an immutable GitHub file URL plus the matching full 40-character commit SHA.

## Stored verification result

The accepted-state call `get_verification(1, 0, 1)` returned:

```json
{
  "outcome": "APPROVED",
  "round": 1,
  "evidence_commit_sha": "2ca6f57606d162f0bfafe81a9c74b9b0bf25d07b",
  "criteria_results": [
    {
      "criterion_index": 0,
      "met": true,
      "reason": "README.md at provided commit explicitly states that the freelancer must submit an immutable GitHub file URL plus the matching full 40-character commit SHA."
    }
  ],
  "summary": "Criterion 0 is met. The README in the referenced commit clearly instructs freelancers to submit an immutable GitHub file URL and its matching 40-character commit SHA."
}
```

This demonstrates more than deployment: it records the agreement state machine, role-gated writes, external evidence retrieval, structured AI evaluation, independent validator execution, consensus acceptance, and a persisted `APPROVED` verdict.
