# Minimal CIP-0056 Starter

This is a **placeholder** starter repo that mirrors the structure of a Canton CIP-0056 token implementation (holdings view, FOP transfer instruction, DvP allocation) similar to Splice patterns.

> Nothing here is production-ready. Most modules contain TODOs and commented cues where you would wire the real interfaces and logic.

## Highlights

- `MyToken` and `LockedMyToken` templates
- A tiny `TwoStepTransfer` helper (accept/abort)
- `MyTransferInstruction` and `MyAllocation` templates with accept/withdraw/cancel choices
- `TokenApiUtils` with placeholder DNS-scoped metadata keys
- `Scripts.daml` to show the end-to-end flow (mint + lock + transfer instruction + accept)

## Wiring to real CIP-0056 interfaces
Replace the "TODO: implement Api.Token.* ." comments with actual interface instances (e.g., `Api.Token.HoldingV1`, `Api.Token.TransferInstructionV1`, `Api.Token.AllocationV1`) provided by your DARs and add those DARs under `data-dependencies` in `daml.yaml`.

## Quick start
1. `./get-dependencies.sh`
2. Run:
    ```bash
    # daml build
    daml build -Wno-template-interface-depends-on-daml-script -Wno-unused-dependency
    daml test
   ```
If you haven't wired real interfaces, compilation may fail - that's expected given the placeholders.

## Readings and links:

- Daml v3 (3.3) docs: https://docs.digitalasset.com/build/3.3/index.html
- Daml‑Finance “Holdings” tutorial (v2): https://docs.daml.com/daml-finance/tutorials/getting-started/holdings.html
- CIP‑56 spec: https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- Splice repo (token standard + tests + wallet helpers): https://github.com/hyperledger-labs/splice
  - Token standard folder: https://github.com/hyperledger-labs/splice/tree/main/token-standard
  - Wallet client helper (example): https://github.com/hyperledger-labs/splice/blob/main/token-standard/splice-token-standard-test/daml/Splice/Testing/TokenStandard/WalletClient.daml
