# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript SDK for interacting with Canton Network's token system via the Wallet SDK. The SDK provides helper functions for creating token factories, minting tokens, transferring tokens, and querying balances on a Canton ledger, built on top of the minimal-token Daml application located in the sibling `../minimal-token` directory.

## Additional Documentation

- **[Splice Wallet Kernel Reference](notes/SPLICE-WALLET-KERNEL.md)** - Key learnings about exercising Daml interface choices through the Canton Ledger HTTP API, including template ID formats, common errors, and patterns from the splice-wallet-kernel implementation.

## Prerequisites

Before running this SDK:
1. Compile the `minimal-token` DAR file in the sibling directory: `cd ../minimal-token && daml build`
2. Fetch localnet dependencies from the monorepo root: `pnpm fetch:localnet`
3. Start the localnet from the monorepo root: `pnpm start:localnet`

## Development Commands

### Building
- `pnpm build` - Compile TypeScript and bundle with esbuild
- `pnpm build:watch` - Watch mode for continuous building
- `pnpm tsc` - TypeScript compilation only
- `pnpm esbuild` - esbuild bundling only

### Testing
- `pnpm test` - Run tests once (CI mode)
- `pnpm test:watch` - Run tests in watch mode

### Linting
- `pnpm lint` - Check for linting errors
- `pnpm lint:fix` - Auto-fix linting errors

### Running Scripts
- `tsx src/uploadDars.ts` - Upload the minimal-token DAR to the ledger (run once before using scripts)
- `tsx src/hello.ts` - Basic demo script showing token operations
- `tsx src/testScripts/threePartyTransfer.ts` - Comprehensive three-party transfer demonstration
- `tsx src/testScripts/transferWithPreapproval.ts` - Transfer with preapproval pattern
- `tsx src/testScripts/bondLifecycleTest.ts` - Complete bond lifecycle demonstration (mint, coupon, transfer, redemption)

### Other Commands
- `pnpm clean` - Remove build artifacts
- `pnpm ledger-schema` - Regenerate OpenAPI types from local ledger (requires ledger running on localhost:7575)
- `pnpm get:minimal-token-id` - Extract package ID from compiled DAR file

## Architecture

### Core Components

**SDK Initialization (`src/hello.ts`, `src/sdkHelpers.ts`)**
- Configures `WalletSDKImpl` with localnet defaults for auth, ledger, and token standard
- Connects to the Canton ledger and topology service
- Creates external parties (Alice, Bob, Charlie) using Ed25519 keypairs generated from seeds
- Allocates parties on the ledger via signed multi-hashes

**Wrapped SDK Helpers (`src/wrappedSdk/`)**

All helpers follow a consistent pattern with single-party perspective and template IDs centralized in `src/constants/templateIds.ts`:

**`tokenFactory.ts`** - Token factory management
- `createTokenFactory()` / `getLatestTokenFactory()` / `getOrCreateTokenFactory()` - Manage MyTokenFactory contracts
- `mintToken()` - Direct Mint choice (requires multi-party signing - use IssuerMintRequest pattern instead)
- `getMintTokenCommand()` - Create mint command

**`issuerMintRequest.ts`** - Two-step minting pattern (recommended)
- `createIssuerMintRequest()` - Receiver creates mint request
- `getLatestIssuerMintRequest()` - Query for mint requests
- `acceptIssuerMintRequest()` - Issuer accepts request, mints tokens
- `declineIssuerMintRequest()` - Issuer declines request
- `withdrawIssuerMintRequest()` - Issuer withdraws request
- **Pattern**: Receiver proposes → Issuer accepts → Tokens minted (avoids multi-party signing)

**`tokenRules.ts`** - Token locking rules
- `createTokenRules()` / `getLatestTokenRules()` / `getOrCreateTokenRules()` - Manage MyTokenRules contracts
- Required for transfer operations that need token locking

**`transferFactory.ts`** - Transfer factory management
- `createTransferFactory()` / `getLatestTransferFactory()` / `getOrCreateTransferFactory()` - Manage MyTransferFactory contracts
- Requires `rulesCid` parameter (from tokenRules)

**`transferRequest.ts`** - Transfer request/accept pattern
- `createTransferRequest()` - Sender creates transfer request
- `getLatestTransferRequest()` - Query for transfer requests
- `acceptTransferRequest()` - Admin accepts request (locks tokens, creates instruction)
- `declineTransferRequest()` - Admin declines request
- `withdrawTransferRequest()` - Sender withdraws request
- `buildTransfer()` - Helper to construct Transfer objects with proper timestamps
- `emptyMetadata()` / `emptyChoiceContext()` / `emptyExtraArgs()` - Metadata helpers
- Type definitions: `Transfer`, `InstrumentId`, `Metadata`, `ExtraArgs`

**`contractDisclosure.ts`** - Generic disclosure helper
- `getContractDisclosure()` - Get disclosure for any contract by template ID and contract ID
- Returns `DisclosedContract` with `contractId`, `createdEventBlob`, `templateId`, `synchronizerId`
- Used by other disclosure functions

**`disclosure.ts`** - Transfer-specific disclosure helpers
- `getTransferInstruction()` - Query MyTransferInstruction contract
- `getTransferInstructionDisclosure()` - Get disclosure for receiver (includes locked token)
- `getMyTokenDisclosure()` - Get disclosure for MyToken contracts
- Required for three-party transfers where receiver needs to see locked tokens

**`balances.ts`** - Token balance queries
- `getBalances()` - Get all token balances for a party (aggregated UTXO model)
- `getBalanceByInstrumentId()` - Get balance for specific instrument
- `formatHoldingUtxo()` - Format holding UTXO data
- Re-exports `getContractDisclosure` for backward compatibility

**`transferPreapproval.ts` / `transferPreapprovalProposal.ts`** - Transfer preapproval patterns
- Support for preapproved transfer workflows

**`wrappedSdk.ts`** - SDK wrapper convenience functions
- `getWrappedSdkWithKeyPair()` - Create wrapped SDK with key pair

**DAR Upload (`src/uploadDars.ts`)**
- Checks if the minimal-token package is already uploaded via `isPackageUploaded()`
- Uploads the DAR file from `../minimal-token/.daml/dist/minimal-token-0.1.0.dar` if not present
- Package ID is hardcoded but can be regenerated with `pnpm get:minimal-token-id`

**Template ID Constants (`src/constants/templateIds.ts`)**
- Centralized template ID definitions
- Template IDs are prefixed with `#minimal-token:` (e.g., `#minimal-token:MyTokenFactory:MyTokenFactory`)

### Canton Ledger Interaction Pattern

The SDK uses a consistent pattern for ledger operations:

1. **Command Creation**: Create a `WrappedCommand` (CreateCommand or ExerciseCommand)
2. **Submission**: Use `prepareSignExecuteAndWaitFor()` with:
   - Command array
   - Private key for signing
   - UUID correlation ID
3. **Contract Queries**: Use `activeContracts()` filtered by party and template ID

### Key Architectural Notes

- **Single-Party Design**: All SDK wrapper functions operate from a single party's perspective (one ledger controller, one key pair at a time)
- **External Party Management**: Parties are created externally with Ed25519 keypairs, then allocated on-ledger by signing their multi-hash
- **InstrumentId Format**: Tokens are identified by `{admin: partyId, id: fullInstrumentId}` where fullInstrumentId is typically `partyId#TokenName`
- **UTXO Model**: Token balances are tracked as separate contracts (UTXOs); the SDK aggregates them in `getBalances()`
- **Party Context Switching**: `sdk.setPartyId()` is used to switch context when querying different parties' holdings
- **Request/Accept Pattern**: Multi-party operations use a two-step pattern to avoid multi-party signing limitations

### Three-Party Transfer Flow

The `threePartyTransfer.ts` script demonstrates the complete three-party authorization pattern:

**Setup Phase (Charlie as issuer/admin):**
```typescript
const rulesCid = await getOrCreateTokenRules(charlieLedger, charlieKeyPair);
const transferFactoryCid = await getOrCreateTransferFactory(charlieLedger, charlieKeyPair, rulesCid);
const tokenFactoryCid = await getOrCreateTokenFactory(charlieLedger, charlieKeyPair, instrumentId);
```

**Minting Phase (Two-step: Alice proposes, Charlie accepts):**
```typescript
// Step 1: Alice creates mint request
await createIssuerMintRequest(aliceLedger, aliceKeyPair, {
    tokenFactoryCid,
    issuer: charlie,
    receiver: alice,
    amount: 100,
});

// Step 2: Alice queries for the request CID
const mintRequestCid = await getLatestIssuerMintRequest(aliceLedger, charlie);

// Step 3: Charlie accepts the request (mints tokens)
await acceptIssuerMintRequest(charlieLedger, charlieKeyPair, mintRequestCid);
```

**Transfer Request Phase (Alice proposes transfer to Bob):**
```typescript
const transfer = buildTransfer({
    sender: alice,
    receiver: bob,
    amount: 50,
    instrumentId: { admin: charlie, id: instrumentId },
    requestedAt: new Date(Date.now() - 1000),      // Past
    executeBefore: new Date(Date.now() + 3600000), // Future
    inputHoldingCids: [aliceTokenCid],
});

await createTransferRequest(aliceLedger, aliceKeyPair, {
    transferFactoryCid,
    expectedAdmin: charlie,
    transfer,
    extraArgs: emptyExtraArgs(),
});
```

**Approval Phase (Charlie accepts, locks tokens):**
```typescript
const requestCid = await getLatestTransferRequest(aliceLedger, charlie);
await acceptTransferRequest(charlieLedger, charlieKeyPair, requestCid);
// Creates MyTransferInstruction with locked tokens
```

**Disclosure Phase (Charlie provides disclosure to Bob):**
```typescript
const disclosure = await getTransferInstructionDisclosure(
    charlieLedger,
    transferInstructionCid
);
// Returns: { lockedTokenDisclosure, transferInstruction }
```

**Acceptance Phase (Bob accepts - requires multi-party API):**
- Bob needs to accept the MyTransferInstruction
- Requires lower-level LedgerClient API with disclosed contracts
- See Multi-Party Transaction Workarounds below for implementation details

### Bond Operations

The SDK provides comprehensive support for bond instruments following CIP-0056 standards and daml-finance patterns. The bond implementation demonstrates:
- Fungible bond architecture with lifecycle management
- Coupon payment processing
- Bond transfers with partial amount support
- Redemption at maturity

#### Bond Architecture Overview

**Fungible Bond Model:**

Bonds use a fungible design where a single contract can hold multiple bond units:
- **notional**: Face value per bond unit (e.g., $1000 per bond)
- **amount**: Number of bond units held (e.g., 3 bonds)
- **Total face value**: `notional × amount` (e.g., $1000 × 3 = $3000)

This allows efficient portfolio management - you can hold 100 bonds in a single contract rather than 100 separate contracts.

**BondFactory Stores Bond Terms:**

Unlike token factories, BondFactory stores the bond's terms (`notional`, `couponRate`, `couponFrequency`). All bonds minted from a specific factory share:
- Same notional (face value per unit)
- Same coupon rate (e.g., 5% annual)
- Same coupon frequency (e.g., 2 = semi-annual payments)

Only the maturity date varies per bond issuance.

**Per-Unit Payment Calculations:**

Lifecycle events (coupons, redemption) calculate payments on a per-unit basis:
- **Coupon payment**: `(notional × couponRate / couponFrequency) × amount`
  - Example: `(1000 × 0.05 / 2) × 3 = 25 × 3 = $75`
- **Redemption payment**: `(notional × amount) + final coupon`
  - Example: `(1000 × 3) + 75 = $3075`

**Partial Transfer Support:**

BondRules supports splitting bonds for partial transfers:
- If you hold 3 bonds and transfer 1, the system automatically:
  - Locks 1 bond for transfer
  - Creates a "change" bond with the remaining 2 bonds
  - Returns the change bond to you immediately

#### Bond Wrapper Modules

**`bonds/bondRules.ts`** - Centralized locking authority
- `createBondRules()` - Create issuer-signed bond rules (required for all bond operations)
- `getLatestBondRules()` - Query latest bond rules by issuer
- `getOrCreateBondRules()` - Get existing or create new bond rules

Pattern: Issuer-signed, owner-controlled. The issuer signs the rules, but the bond owner controls when to invoke locking operations.

**`bonds/factory.ts`** - Bond minting factory
- `createBondFactory(userLedger, userKeyPair, instrumentId, notional, couponRate, couponFrequency)` - Create factory with bond terms
- `getLatestBondFactory()` - Query latest factory by instrument ID
- `getOrCreateBondFactory()` - Get existing or create new factory

**Important**: The factory stores `notional`, `couponRate`, and `couponFrequency`. These terms are shared by all bonds minted from this factory. Only `amount` and `maturityDate` vary per mint.

**`bonds/issuerMintRequest.ts`** - Two-step bond minting
- `createBondIssuerMintRequest(receiverLedger, receiverKeyPair, params)` - Receiver proposes bond mint
  - `params.amount` - Number of bond units (NOT principal amount)
  - `params.maturityDate` - ISO string date when bond matures
- `getLatestBondIssuerMintRequest()` - Query latest mint request
- `getAllBondIssuerMintRequests()` - Query all mint requests for issuer
- `acceptBondIssuerMintRequest(issuerLedger, issuerKeyPair, contractId)` - Issuer accepts, mints bonds
- `declineBondIssuerMintRequest()` - Issuer declines request
- `withdrawBondIssuerMintRequest()` - Receiver withdraws request

**Pattern**: Receiver proposes → Issuer accepts → Bonds minted (avoids three-party signing: issuer, depository, owner)

**`bonds/lifecycleRule.ts`** - Lifecycle event processing
- `createBondLifecycleRule(userLedger, userKeyPair, params)` - Create lifecycle rule
  - `params.depository` - Depository party (often same as issuer)
  - `params.currencyInstrumentId` - Currency used for payments
- `getLatestBondLifecycleRule()` - Query latest rule
- `getOrCreateBondLifecycleRule()` - Get existing or create new rule
- `processCouponPaymentEvent(userLedger, userKeyPair, contractId, params)` - Process coupon payment
  - `params.targetInstrumentId` - Bond instrument ID
  - `params.targetVersion` - Current bond version (for version tracking)
  - `params.bondCid` - Sample bond contract (used to infer bond terms)
- `processRedemptionEvent(userLedger, userKeyPair, contractId, params)` - Process redemption at maturity
  - `params.bondCid` - Sample bond contract (used to infer bond terms)

**Security**: Uses ledger time (`getTime`) directly instead of accepting dates as parameters. This prevents time manipulation attacks where an issuer could backdate or future-date lifecycle events.

**Term Inference**: Lifecycle rules infer bond terms (`notional`, `couponRate`, `couponFrequency`) from a sample bond contract, ensuring consistency and reducing redundant parameters.

**`bonds/lifecycleEffect.ts`** - Effect query helper
- `getLatestBondLifecycleEffect(ledger, party)` - Query latest lifecycle effect
  - Returns: `{ contractId, producedVersion }` where `producedVersion` is the new bond version after coupon payment (or `null` for redemption)

**Pattern**: Lifecycle effects are single source of truth. The issuer creates one effect contract that all holders of the target bond version can claim.

**`bonds/lifecycleClaimRequest.ts`** - Claim lifecycle events
- `createBondLifecycleClaimRequest(holderLedger, holderKeyPair, params)` - Holder creates claim for coupon/redemption
  - `params.effectCid` - Lifecycle effect contract to claim
  - `params.bondHoldingCid` - Holder's bond contract
  - `params.bondRulesCid` - Bond rules for locking
  - `params.bondFactoryCid` - Bond factory (for creating new version after coupon)
  - `params.currencyTransferFactoryCid` - Currency transfer factory (for payment)
  - `params.issuerCurrencyHoldingCid` - Issuer's currency holding to use for payment
- `getLatestBondLifecycleClaimRequest()` - Query latest claim request
- `getAllBondLifecycleClaimRequests()` - Query all claim requests for issuer
- `acceptBondLifecycleClaimRequest(issuerLedger, issuerKeyPair, contractId)` - Issuer accepts claim
  - Creates `BondLifecycleInstruction` for holder to process
  - Creates currency `TransferInstruction` for payment
- `declineBondLifecycleClaimRequest()` - Issuer declines claim
- `withdrawBondLifecycleClaimRequest()` - Holder withdraws claim

**Payment Calculation**: The system multiplies `effect.amount` (per-unit amount) by `bond.amount` (number of units) to calculate total payment. Example: If effect amount is $25 per bond and holder has 3 bonds, total payment is $75.

**`bonds/lifecycleInstruction.ts`** - Execute lifecycle events
- `processBondLifecycleInstruction(holderLedger, holderKeyPair, contractId, disclosures?)` - Process lifecycle instruction
  - For coupon payments: Archives old bond, creates new bond version, updates `lastEventTimestamp`
  - For redemption: Archives bond (no new version created)
  - Requires BondFactory disclosure for coupon payments (to create new version)
- `getBondLifecycleInstruction()` - Query lifecycle instruction
- `getBondLifecycleInstructionDisclosure()` - Get BondFactory disclosure for coupon processing

**Disclosure Requirements**:
- **Coupon payments**: Requires BondFactory disclosure (holder needs to see factory to create new bond version)
- **Redemption**: No disclosure required (bond is simply archived)

**`bonds/transferFactory.ts`** - Bond transfer factory
- `createBondTransferFactory(userLedger, userKeyPair, rulesCid)` - Create transfer factory with bond rules reference
- `getLatestBondTransferFactory()` - Query latest factory
- `getOrCreateBondTransferFactory()` - Get existing or create new factory

**`bonds/transferRequest.ts`** - Bond transfer request/accept
- `createBondTransferRequest(senderLedger, senderKeyPair, params)` - Sender creates transfer request
  - `params.transfer.amount` - Number of bond units to transfer (can be partial)
- `getLatestBondTransferRequest()` - Query latest transfer request
- `acceptBondTransferRequest(adminLedger, adminKeyPair, contractId)` - Admin accepts request
  - Locks bonds via BondRules (automatically creates change bond if partial transfer)
  - Creates `BondTransferInstruction` in pending state
- `declineBondTransferRequest()` - Admin declines request
- `withdrawBondTransferRequest()` - Sender withdraws request

**Partial Transfers**: If transferring less than total holdings, BondRules automatically splits the bond:
- Locks the requested amount
- Creates a change bond with the remainder
- Returns change bond to sender immediately

**`bonds/transferInstruction.ts`** - Bond transfer acceptance
- `acceptBondTransferInstruction(receiverLedger, receiverKeyPair, contractId, disclosures, params?)` - Receiver accepts transfer
  - Requires LockedBond disclosure (receiver needs to see locked bond)
- `rejectBondTransferInstruction()` - Receiver rejects (returns locked bond to sender)
- `withdrawBondTransferInstruction()` - Sender withdraws (unlocks bond back to sender)
- `getLatestBondTransferInstruction()` - Query latest transfer instruction
- `getBondTransferInstructionDisclosure(adminLedger, transferInstructionCid)` - Get LockedBond disclosure for receiver

**Disclosure Requirements**: Receiver must obtain LockedBond disclosure from admin before accepting transfer (LockedBond is not visible to receiver by default).

#### Complete Bond Lifecycle Flow

**Phase 1: Infrastructure Setup (Issuer)**
```typescript
const bondRulesCid = await charlieWrappedSdk.bonds.bondRules.getOrCreate();
const bondFactoryCid = await charlieWrappedSdk.bonds.factory.getOrCreate(
    bondInstrumentId,
    1000.0,  // notional (face value per bond)
    0.05,    // couponRate (5% annual)
    2        // couponFrequency (semi-annual)
);
const lifecycleRuleCid = await charlieWrappedSdk.bonds.lifecycleRule.getOrCreate({
    depository: charlie.partyId,
    currencyInstrumentId: { admin: charlie.partyId, id: currencyInstrumentId },
});
```

**Phase 2: Bond Minting (Receiver proposes, Issuer accepts)**
```typescript
// Alice creates mint request for 3 bond units
await aliceWrappedSdk.bonds.issuerMintRequest.create({
    bondFactoryCid,
    issuer: charlie.partyId,
    depository: charlie.partyId,
    receiver: alice.partyId,
    amount: 3.0,  // 3 bonds, each with $1000 notional = $3000 total face value
    maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
});

// Issuer accepts mint request
const mintRequestCid = await aliceWrappedSdk.bonds.issuerMintRequest.getLatest(charlie.partyId);
await charlieWrappedSdk.bonds.issuerMintRequest.accept(mintRequestCid);
```

**Phase 3: Coupon Payment (Issuer processes, Holder claims)**
```typescript
// Wait 6 months (for semi-annual coupon)

// Issuer processes coupon event (uses ledger time)
await charlieWrappedSdk.bonds.lifecycleRule.processCouponPaymentEvent(
    lifecycleRuleCid,
    {
        targetInstrumentId: bondInstrumentId,
        targetVersion: "0",  // Initial version
        bondCid: aliceBondCid,  // Sample bond for term inference
    }
);

// Get the effect and new version
const { contractId: effectCid, producedVersion } =
    await charlieWrappedSdk.bonds.lifecycleEffect.getLatest(charlie.partyId);

// Holder creates claim request
await aliceWrappedSdk.bonds.lifecycleClaimRequest.create({
    effectCid,
    bondHoldingCid: aliceBondCid,
    bondRulesCid,
    bondFactoryCid,
    currencyTransferFactoryCid,
    issuerCurrencyHoldingCid: currencyHolding1,
    holder: alice.partyId,
    issuer: charlie.partyId,
});

// Issuer accepts claim (creates instruction + currency transfer)
const claimCid = await aliceWrappedSdk.bonds.lifecycleClaimRequest.getLatest(charlie.partyId);
await charlieWrappedSdk.bonds.lifecycleClaimRequest.accept(claimCid);

// Holder processes instruction (with BondFactory disclosure)
const instructionCid = await charlieWrappedSdk.bonds.lifecycleInstruction.getLatest(charlie.partyId);
const bondFactoryDisclosure = await charlieWrappedSdk.bonds.lifecycleInstruction.getDisclosure(instructionCid);
await aliceWrappedSdk.bonds.lifecycleInstruction.process(
    instructionCid,
    bondFactoryDisclosure ? [bondFactoryDisclosure] : undefined
);

// Holder accepts currency transfer (with LockedToken disclosure)
const transferCid = await charlieWrappedSdk.transferInstruction.getLatest(charlie.partyId);
if (transferCid) {
    const disclosure = await charlieWrappedSdk.transferInstruction.getDisclosure(transferCid);
    await aliceWrappedSdk.transferInstruction.accept(transferCid, [disclosure.lockedTokenDisclosure]);
}

// Result: Alice receives coupon payment (3 bonds × $25 = $75) and has new bond version
```

**Phase 4: Bond Transfer (Sender proposes, Admin accepts, Receiver accepts)**
```typescript
// Alice transfers 1 bond out of 3 to Bob

// Create bond transfer factory
const bondTransferFactoryCid = await charlieWrappedSdk.bonds.transferFactory.getOrCreate(bondRulesCid);

// Alice creates transfer request
await aliceWrappedSdk.bonds.transferRequest.create({
    transferFactoryCid: bondTransferFactoryCid,
    expectedAdmin: charlie.partyId,
    transfer: buildTransfer({
        sender: alice.partyId,
        receiver: bob.partyId,
        amount: 1.0,  // Transfer 1 bond (out of 3)
        instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
        requestedAt: new Date(Date.now() - 1000),
        executeBefore: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
        inputHoldingCids: [aliceBondCid],
    }),
    extraArgs: emptyExtraArgs(),
});

// Admin accepts transfer request (locks 1 bond, creates change bond with 2 remaining)
const transferRequestCid = await aliceWrappedSdk.bonds.transferRequest.getLatest(charlie.partyId);
await charlieWrappedSdk.bonds.transferRequest.accept(transferRequestCid);

// Receiver gets disclosure and accepts transfer
const transferInstrCid = await charlieWrappedSdk.bonds.transferInstruction.getLatest(charlie.partyId);
const disclosure = await charlieWrappedSdk.bonds.transferInstruction.getDisclosure(transferInstrCid);
await bobWrappedSdk.bonds.transferInstruction.accept(transferInstrCid, [disclosure]);

// Result: Bob has 1 bond, Alice has 2 bonds (as change)
```

**Phase 5: Redemption at Maturity (Issuer processes, Holder claims)**
```typescript
// Wait until maturity date

// Issuer processes redemption event (uses ledger time)
await charlieWrappedSdk.bonds.lifecycleRule.processRedemptionEvent(
    lifecycleRuleCid,
    {
        targetInstrumentId: bondInstrumentId,
        targetVersion: producedVersion,  // Current version after coupon
        bondCid: bobBondCid,  // Sample bond for term inference
    }
);

// Get the redemption effect
const { contractId: effectCid2 } =
    await charlieWrappedSdk.bonds.lifecycleEffect.getLatest(charlie.partyId);

// Bob creates claim request
await bobWrappedSdk.bonds.lifecycleClaimRequest.create({
    effectCid: effectCid2,
    bondHoldingCid: bobBondCid,
    bondRulesCid,
    bondFactoryCid,
    currencyTransferFactoryCid,
    issuerCurrencyHoldingCid: currencyHolding2,
    holder: bob.partyId,
    issuer: charlie.partyId,
});

// Issuer accepts claim
const claimCid2 = await bobWrappedSdk.bonds.lifecycleClaimRequest.getLatest(charlie.partyId);
await charlieWrappedSdk.bonds.lifecycleClaimRequest.accept(claimCid2);

// Bob processes instruction (no disclosure needed for redemption)
const instructionCid2 = await charlieWrappedSdk.bonds.lifecycleInstruction.getLatest(charlie.partyId);
await bobWrappedSdk.bonds.lifecycleInstruction.process(instructionCid2);

// Bob accepts currency transfer (principal + final coupon: 1 bond × $1025 = $1025)
const transferCid2 = await charlieWrappedSdk.transferInstruction.getLatest(charlie.partyId);
if (transferCid2) {
    const disclosure2 = await charlieWrappedSdk.transferInstruction.getDisclosure(transferCid2);
    await bobWrappedSdk.transferInstruction.accept(transferCid2, [disclosure2.lockedTokenDisclosure]);
}

// Result: Bob receives redemption payment ($1000 principal + $25 final coupon = $1025), bond is archived
```

#### Key Differences from Token Operations

1. **Three-Party Authorization**: Bonds require `issuer`, `depository`, and `owner` signatures (tokens only require `issuer` and `owner`)

2. **Lifecycle Events**: Bonds have lifecycle events (coupons, redemption) that create effects claimable by all holders

3. **Fungible Architecture**: A single bond contract can hold multiple bond units, enabling efficient portfolio management

4. **Term Storage**: BondFactory stores bond terms (`notional`, `couponRate`, `couponFrequency`) shared by all bonds from that factory

5. **Per-Unit Payments**: Payment calculations are per-unit and multiplied by the number of bonds held

6. **Partial Transfers**: BondRules automatically splits bonds for partial transfers, creating change bonds

7. **Version Tracking**: Bonds have version strings that increment with each coupon payment, preventing double-claiming of lifecycle events

8. **Ledger Time Security**: Lifecycle events use ledger time directly to prevent time manipulation attacks

9. **Term Inference**: Lifecycle rules infer bond terms from sample bond contracts, ensuring consistency

### Known Issues and Multi-Party Authorization

#### Multi-Party Signing Challenge

The `MyToken` contract in `../minimal-token/daml/MyToken.daml` defines:
```daml
template MyToken
  with
    issuer : Party
    owner  : Party
    ...
  where
    signatory issuer, owner
```

This means **both the issuer and owner must sign** any transaction that creates a MyToken contract.

**✅ SOLVED for Minting**: Use the `IssuerMintRequest` pattern (implemented in `issuerMintRequest.ts`):
- Receiver creates `IssuerMintRequest` (receiver signs)
- Issuer accepts request, which exercises the Mint choice (issuer signs)
- This two-step pattern avoids the multi-party signing requirement

**❌ REMAINING ISSUE for Transfer Acceptance**: When Bob accepts a MyTransferInstruction:
1. The Accept choice unlocks LockedMyToken and creates new MyToken for receiver
2. Creating the new MyToken requires both issuer (Charlie) and new owner (Bob) signatures
3. The high-level Wallet SDK API doesn't support multi-party external signing
4. Requires lower-level LedgerClient API (see workarounds below)

#### Wallet SDK Limitations

The high-level Wallet SDK API does not support multi-party external signing:
- `prepareSignExecuteAndWaitFor()` only accepts a single private key
- `prepareSubmission()` uses the party set on the LedgerController (via `setPartyId()`)
- The `actAs` field in commands is not exposed at the high-level API

#### Multi-Party Transaction Workarounds

To submit multi-party transactions with external signing, you must use the lower-level `LedgerClient` API directly:

**Prepare Request Structure:**
```typescript
await client.postWithRetry("/v2/interactive-submission/prepare", {
    commands: [{ ExerciseCommand: ... }],
    commandId: "unique-id",
    actAs: ["party1", "party2"],  // Multiple parties
    readAs: [],
    userId: "ledger-api-user",
    synchronizerId: "...",
    disclosedContracts: [],
    packageIdSelectionPreference: [],
    verboseHashing: false,
});
```

**Execute Request Structure:**
```typescript
await client.postWithRetry("/v2/interactive-submission/execute", {
    preparedTransaction: preparedTxHash,
    partySignatures: {
        signatures: [
            {
                party: "party1",
                signatures: [{
                    format: "SIGNATURE_FORMAT_RAW",
                    signature: "...",
                    signedBy: "publicKey1",
                    signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519"
                }]
            },
            {
                party: "party2",
                signatures: [{
                    format: "SIGNATURE_FORMAT_RAW",
                    signature: "...",
                    signedBy: "publicKey2",
                    signingAlgorithmSpec: "SIGNING_ALGORITHM_SPEC_ED25519"
                }]
            }
        ]
    },
    deduplicationPeriod: ...,
    submissionId: "...",
    userId: "ledger-api-user",
    hashingSchemeVersion: "HASHING_SCHEME_VERSION_V2"
});
```

**Note:** The private `client` property on `LedgerController` can be accessed at runtime (TypeScript's `private` is compile-time only), but this is not a supported pattern.

#### Alternative Approaches

1. **Use Internal Parties**: Internal parties use Canton's built-in keys and don't require the interactive submission flow
2. **Use Lower-Level API**: Implement transfer acceptance using LedgerClient API with multi-party signatures and disclosed contracts
3. **Redesign the Contract**: Modify the Daml template to only require the current owner's signature for transfers
4. **Implement Request/Accept for Transfers**: Similar to minting, create a two-step transfer acceptance pattern

## SDK Wrapper Design Principles

When creating new SDK wrapper functions, follow these patterns:

### Single-Party Perspective
- Each function operates from a single party's perspective
- Takes one `LedgerController` and one `UserKeyPair` parameter
- No functions should require multiple parties' credentials simultaneously
- Example: `createIssuerMintRequest(receiverLedger, receiverKeyPair, params)` - only receiver's perspective

### Consistent Naming Patterns
- `create{Contract}` - Create a new contract
- `getLatest{Contract}` - Query for most recent contract
- `getOrCreate{Contract}` - Get existing or create new
- `accept{Request}` - Accept a request contract
- `decline{Request}` - Decline a request contract
- `withdraw{Request}` - Withdraw a request contract

### Template ID Management
- All template IDs centralized in `src/constants/templateIds.ts`
- Import and use constants rather than hardcoding strings
- Format: `#minimal-token:ModuleName:TemplateName`

### Query Patterns
- Use `activeContracts()` filtered by party and template ID
- Filter results by relevant parameters (issuer, receiver, etc.)
- Return most recent contract with `[filteredEntries.length - 1]`
- Return `undefined` if no matching contracts found

### Command Creation
- Use `getCreateCommand()` helper for CreateCommand
- Use `getExerciseCommand()` helper for ExerciseCommand
- Use `prepareSignExecuteAndWaitFor()` for submission
- Generate UUID with `v4()` for correlation IDs

### Type Definitions
- Define parameter interfaces for each contract/choice
- Use `Party` and `ContractId` types from `src/types/daml.js`
- Export types for use in other modules

#### Other TODOs

- The codebase includes TODOs around using `submitCommand` vs `prepareSignExecuteAndWaitFor` with notes about synchronizer submission errors

## Testing

### Unit Tests
Tests are located in `src/index.test.ts` and use Vitest. The test setup is in `vitest.setup.ts`.

### Integration Test Scripts

**`src/testScripts/threePartyTransfer.ts`** - Comprehensive three-party transfer demonstration
- Demonstrates complete flow: Charlie (issuer) → Alice (sender) → Bob (receiver)
- Covers: infrastructure setup, two-step minting, transfer request/accept, disclosure
- Shows how to use all new SDK wrapper functions
- Documents the final multi-party acceptance limitation
- Run with: `tsx src/testScripts/threePartyTransfer.ts`

**`src/testScripts/transferWithPreapproval.ts`** - Transfer with preapproval pattern
- Demonstrates transfer preapproval workflow
- Shows proposal/accept pattern for transfers
- Run with: `tsx src/testScripts/transferWithPreapproval.ts`

**`src/testScripts/bondLifecycleTest.ts`** - Complete bond lifecycle demonstration
- Demonstrates fungible bond architecture (mint 3 bonds, transfer 1, redeem separately)
- Covers: infrastructure setup, bond minting, coupon payment, partial transfer, redemption
- Shows bond-specific patterns: version tracking, term inference, per-unit payments, disclosure requirements
- Run with: `tsx src/testScripts/bondLifecycleTest.ts`

**`src/hello.ts`** - Basic token operations
- Simple demo of token factory creation and minting
- Good starting point for understanding the SDK
- Run with: `tsx src/hello.ts`

## Build Output

The package builds to three formats:
- `_cjs/` - CommonJS modules
- `_esm/` - ES modules
- `_types/` - TypeScript declaration files
