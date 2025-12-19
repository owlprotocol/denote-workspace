# CLAUDE.md - TypeScript SDK

TypeScript SDK for Canton Network token operations via Wallet SDK. Built on `../minimal-token` Daml contracts.

## Quick Reference

**Setup**: Compile DAR (`cd ../minimal-token && daml build`), fetch deps (`pnpm fetch:localnet`), start localnet (`pnpm start:localnet`)

**Build**: `pnpm build` | `pnpm test` | `pnpm lint:fix`

**Scripts**:
- `tsx src/uploadDars.ts` - Upload DAR (run once)
- `tsx src/hello.ts` - Basic token operations
- `tsx src/testScripts/threePartyTransfer.ts` - Three-party transfer demo
- `tsx src/testScripts/bondLifecycleTest.ts` - Bond lifecycle demo
- `tsx src/testScripts/etfMint.ts` / `etfBurn.ts` - ETF operations

## Architecture

### SDK Wrappers (`src/wrappedSdk/`)

All wrappers follow CRUD pattern: `create`, `getLatest`, `getOrCreate`, `accept`/`decline`/`withdraw`.

**Core Token Operations**:
- `tokenFactory.ts` - Manage MyTokenFactory (mint authority)
- `issuerMintRequest.ts` - Two-step minting (receiver proposes, issuer accepts)
- `tokenRules.ts` - Locking rules for transfers
- `transferFactory.ts` - Create transfer instructions
- `transferRequest.ts` - Transfer request/accept pattern
- `transferInstruction.ts` - Accept/reject transfers
- `balances.ts` - Query token holdings

**Bond Operations** (`wrappedSdk/bonds/`):
- `factory.ts` - Bond factory (stores notional, couponRate, couponFrequency)
- `issuerMintRequest.ts` - Two-step bond minting
- `bondRules.ts` - Bond locking for transfers
- `lifecycleRule.ts` - Lifecycle event definitions (coupon/redemption)
- `lifecycleEffect.ts` - Query lifecycle effects
- `lifecycleClaimRequest.ts` - Claim lifecycle events
- `lifecycleInstruction.ts` - Execute lifecycle
- `transferFactory.ts` / `transferRequest.ts` / `transferInstruction.ts` - Bond transfers

**ETF Operations** (`wrappedSdk/etf/`):
- `portfolioComposition.ts` - Define basket of assets with weights
- `mintRecipe.ts` - ETF minting rules (no tokenFactory - creates directly)
- `mintRequest.ts` - Mint ETF with backing assets (requester→issuer custody)
- `burnRequest.ts` - Burn ETF, return assets (issuer→requester custody)

### Key Patterns

**Request/Accept**: Sender creates request → Admin accepts → Operation completes (avoids multi-party signing complexity)

**Disclosure**: Use `getTransferInstructionDisclosure()` for receiver visibility (required for three-party transfers)

**Template IDs**: Centralized in `src/constants/templateIds.ts` with `#minimal-token:` prefix

## Token Operations

### Basic Minting (Two-Step Pattern)
```typescript
// 1. Receiver creates mint request
await aliceWrappedSdk.issuerMintRequest.create({
    tokenFactoryCid, issuer, receiver: alice, amount: 100
});

// 2. Issuer accepts
const requestCid = await issuerWrappedSdk.issuerMintRequest.getLatest(alice);
await issuerWrappedSdk.issuerMintRequest.accept(requestCid);
```

### Transfer Pattern
```typescript
// 1. Setup infrastructure (issuer)
const rulesCid = await issuerWrappedSdk.tokenRules.getOrCreate();
const transferFactoryCid = await issuerWrappedSdk.transferFactory.getOrCreate(rulesCid);

// 2. Sender creates transfer request
const transfer = buildTransfer({
    sender: alice, receiver: bob, amount: 50, instrumentId,
    requestedAt: new Date(Date.now() - 1000),
    executeBefore: new Date(Date.now() + 3600000),
    inputHoldingCids: [aliceTokenCid]
});
await aliceWrappedSdk.transferRequest.create({ transferFactoryCid, expectedAdmin: issuer, transfer });

// 3. Issuer accepts (locks tokens, creates instruction)
const requestCid = await issuerWrappedSdk.transferRequest.getLatest(alice);
await issuerWrappedSdk.transferRequest.accept(requestCid);

// 4. Receiver accepts instruction (with disclosure for three-party)
const instructionCid = await bobLedger.transferInstruction.getLatest(bob);
const disclosure = await issuerWrappedSdk.disclosure.getTransferInstructionDisclosure(instructionCid);
await bobWrappedSdk.transferInstruction.accept(instructionCid, disclosure);
```

## Bond Operations

**Architecture**: Fungible bonds (single contract holds multiple units), per-unit coupon payments, version tracking, ledger time security.

**Lifecycle**: Mint → Coupon payments → Transfers → Redemption

**Key Concepts**:
- Bond factory stores terms (notional, couponRate, couponFrequency)
- BondRules provides centralized locking (issuer-signed, owner-controlled)
- LifecycleRule defines events using ledger time (prevents manipulation)
- LifecycleEffect is single source of truth (queries filter by version)
- Coupon payment = `(notional × rate / frequency) × amount`
- Versions increment with each coupon event

### Bond Workflow Summary
```typescript
// 1. Setup: Create bond factory with terms, bond rules, lifecycle rule
// 2. Mint: Receiver proposes → Depository accepts
// 3. Coupon: Holder claims → Depository accepts → Execute instruction
// 4. Transfer: Request → Accept → Receiver accepts with disclosure
// 5. Redeem: Same as coupon but final event
```

See `src/testScripts/bondLifecycleTest.ts` for complete implementation.

## ETF Operations

**Architecture**: ETF tokens backed by basket of underlying assets in issuer custody. No separate factory (MyMintRecipe creates tokens directly to prevent unbacked minting).

### ETF Minting Workflow
```typescript
// 1. Create portfolio composition (issuer)
await issuerWrappedSdk.etf.portfolioComposition.create({
    owner: issuer, name: "My ETF",
    items: [
        { instrumentId: { admin: issuer, id: "Token1" }, weight: 1.0 },
        { instrumentId: { admin: issuer, id: "Token2" }, weight: 1.0 },
        { instrumentId: { admin: issuer, id: "Token3" }, weight: 1.0 }
    ]
});

// 2. Create mint recipe (issuer)
await issuerWrappedSdk.etf.mintRecipe.create({
    issuer, instrumentId: etfInstrumentId,
    authorizedMinters: [alice], composition: portfolioCid
    // No tokenFactory - creates directly to prevent bypass
});

// 3. Acquire underlying tokens (alice)
// ... mint or acquire Token1, Token2, Token3 ...

// 4. Transfer underlying to issuer (alice creates, issuer accepts)
// ... create transfer requests for each token (alice → issuer) ...
// Capture each transfer instruction CID immediately after accept

// 5. Create ETF mint request (alice)
await aliceWrappedSdk.etf.mintRequest.create({
    mintRecipeCid, requester: alice, amount: 1.0,
    transferInstructionCids: [ti1Cid, ti2Cid, ti3Cid], // MUST be in portfolio order
    issuer
});

// 6. Accept mint request (issuer)
await issuerWrappedSdk.etf.mintRequest.accept(mintRequestCid);
// Validates transfers → Executes transfers → Mints ETF
```

### ETF Burning Workflow
```typescript
// 1. Create transfer requests for underlying (issuer → alice)
// ... issuer creates transfer requests for Token1, Token2, Token3 ...

// 2. Accept transfers, capture CIDs (issuer)
const ti1Cid = await issuerWrappedSdk.transferInstruction.getLatest(issuer);
// ... accept remaining transfers, capture CIDs ...

// 3. Create burn request (alice)
await aliceWrappedSdk.etf.burnRequest.create({
    mintRecipeCid, requester: alice, amount: 1.0,
    tokenFactoryCid: etfFactoryCid,
    inputHoldingCid: aliceEtfTokenCid,
    issuer
});

// 4. Accept burn request (issuer)
await issuerWrappedSdk.etf.burnRequest.accept(
    burnRequestCid,
    [ti1Cid, ti2Cid, ti3Cid] // MUST be in portfolio order
);
// Validates transfers → Executes transfers → Burns ETF
```

**Critical**: Transfer instruction CIDs must be in same order as portfolio composition items. Capture each CID immediately after accepting each transfer request.

## Multi-Party Authorization

**Challenge**: MyToken requires `signatory issuer, owner`. High-level Wallet SDK only supports single-party signing.

**Solution**: Use request/accept pattern (sender creates request, admin accepts) instead of direct multi-party operations.

**Lower-Level Alternative**: Use `LedgerClient` API with `/v2/interactive-submission/prepare` and `/v2/interactive-submission/execute` for explicit multi-party signing (not supported in high-level SDK).

## Canton Ledger Interaction

**Pattern**: Create `WrappedCommand` → `prepareSignExecuteAndWaitFor()` with private key and UUID → Query via `activeContracts()`

**Party Context**: Use `sdk.setPartyId()` to switch query perspective

**InstrumentId Format**: `{admin: partyId, id: fullInstrumentId}` where fullInstrumentId is typically `partyId#TokenName`

## Known Issues

### Transfer Array Ordering (ETF)
**Issue**: `transferInstructionCids` must match exact order of `portfolioComp.items`
**Error**: "instrumentId does not match" if order wrong
**Solution**: Track portfolio order when creating transfers, capture CIDs immediately after each accept

### Multi-Party Signing
**Issue**: High-level API doesn't support multi-party external signing
**Workaround**: Use request/accept pattern or lower-level `LedgerClient` API

## Template IDs Reference

All template IDs in `src/constants/templateIds.ts`:
- `myTokenTemplateId` = `#minimal-token:MyToken:MyToken`
- `tokenFactoryTemplateId` = `#minimal-token:MyTokenFactory:MyTokenFactory`
- `issuerMintRequestTemplateId` = `#minimal-token:MyToken.IssuerMintRequest:IssuerMintRequest`
- `tokenRulesTemplateId` = `#minimal-token:MyTokenRules:MyTokenRules`
- `transferFactoryTemplateId` = `#minimal-token:MyTransferFactory:MyTransferFactory`
- `transferRequestTemplateId` = `#minimal-token:MyToken.TransferRequest:TransferRequest`
- `transferInstructionTemplateId` = `#minimal-token:MyTokenTransferInstruction:MyTransferInstruction`
- ETF: `portfolioCompositionTemplateId`, `mintRecipeTemplateId`, `etfMintRequestTemplateId`, `etfBurnRequestTemplateId`
- Bonds: `bondFactoryTemplateId`, `bondRulesTemplateId`, `lifecycleRuleTemplateId`, etc.

## Testing

Tests in `src/index.test.ts` using Vitest. Setup in `vitest.setup.ts`.

## Build Output

- `_cjs/` - CommonJS modules
- `_esm/` - ES modules
- `_types/` - TypeScript declarations

## Additional Documentation

See `notes/SPLICE-WALLET-KERNEL.md` for Daml interface choice patterns and Canton Ledger HTTP API reference.
