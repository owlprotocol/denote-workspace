# CLAUDE.md - Workspace Root

This file provides guidance to Claude Code (claude.ai/code) when working with code in this monorepo workspace.

## Workspace Structure

This is a monorepo containing two main packages:

- **`packages/minimal-token/`** - Daml token implementation following Canton CIP-0056 standard
- **`packages/token-sdk/`** - TypeScript SDK for interacting with the token contracts via Canton Wallet SDK

## Quick Start

### Prerequisites

1. Compile the minimal-token DAR: `cd packages/minimal-token && daml build`
2. Fetch localnet dependencies from monorepo root: `pnpm fetch:localnet`
3. Start the localnet from monorepo root: `pnpm start:localnet`

### Common Workflows

**Build and test the Daml token contracts:**
```bash
cd packages/minimal-token
./get-dependencies.sh  # Fetch Splice API DARs
daml build -Wno-template-interface-depends-on-daml-script -Wno-unused-dependency
daml test
```

**Build and test the TypeScript SDK:**
```bash
cd packages/token-sdk
pnpm build
pnpm test
```

**Run demo scripts:**
```bash
cd packages/token-sdk
tsx src/uploadDars.ts    # Upload DAR to ledger (run once)
tsx src/hello.ts          # Basic token operations demo
```

---

# Part 1: Daml Token Implementation (packages/minimal-token)

## Overview

A **placeholder** Canton CIP-0056 token implementation demonstrating standard patterns: holdings view, FOP (Free of Payment) transfer instructions, and DvP (Delivery versus Payment) allocations. Follows Splice's Amulet token standard.

**Note:** Not production-ready. Contains TODOs for real CIP-0056 interface wiring.

## Architecture

### Token Model (Two-State Design)

Following the Splice Amulet pattern:

1. **MyToken** - Unlocked tokens (freely controlled by owner)
2. **LockedMyToken** - Wraps `token : MyToken` with lock metadata (expiry, holders, context)

Both implement `Splice.Api.Token.HoldingV1.Holding` interface (CIP-0056 compliant).

**Key Design:** LockedMyToken wraps MyToken (not field duplication) for type safety.

### Three-Party Authorization

All token transfers require authorization from **three parties**:

1. **Issuer** - Signs MyTokenRules, authorizes locking, controller on MyToken_Transfer
2. **Sender (Owner)** - Controls lock operation via MyTokenRules, controller on transfer choices
3. **Receiver** - Must accept transfer instructions with disclosure

This prevents any two parties from bypassing the issuer's oversight.

### Core Workflow: Two-Step Transfer Pattern

All transfer/allocation operations use the pattern in `MyToken.TwoStepTransfer`:

1. **Prepare (Lock)**: Via `prepareTwoStepTransfer` - locks input holdings using MyTokenRules
2. **Execute (Transfer)**: Via `executeTwoStepTransfer` - validates deadline, unlocks, transfers to receiver
3. **Abort (Unlock)**: Via `abortTwoStepTransfer` - unlocks tokens back to sender if rejected/withdrawn

Used by both **Transfer Instructions** (FOP) and **Allocations** (DvP).

### Key Components

**MyTokenFactory** (`daml/MyTokenFactory.daml`)
- Minting new tokens
- Dual-signatory pattern (issuer + receiver)

**MyTokenRules** (`daml/MyTokenRules.daml`)
- Centralized locking authority (Amulet pattern)
- **Creates LockedMyToken directly** (no Lock choice on MyToken)
- Handles token splitting, returns optional change CID
- Controller: token owner (sender), Signatory: issuer
- Prevents uncontrolled locking

**MyTransferFactory** (`daml/MyTransferFactory.daml`)
- Implements `Splice.Api.Token.TransferInstructionV1.TransferFactory`
- Auto-locks tokens via `prepareTwoStepTransfer`
- Creates `MyTransferInstruction` in pending state
- Request/accept pattern for authorization

**MyTransferInstruction** (`daml/MyTokenTransferInstruction.daml`)
- Implements `Splice.Api.Token.TransferInstructionV1.TransferInstruction`
- Supports Accept (complete), Reject (refund sender), Withdraw (sender cancels)
- Delegates to `TwoStepTransfer` helpers

**MyAllocationFactory** (`daml/MyAllocationFactory.daml`)
- Implements `Splice.Api.Token.AllocationInstructionV1.AllocationFactory`
- Auto-locks tokens for DvP settlement legs
- Creates `MyAllocation` (immediately completed state)

**MyAllocation** (`daml/MyAllocation.daml`)
- Implements `Splice.Api.Token.AllocationV1.Allocation`
- Supports ExecuteTransfer, Withdraw/Cancel
- Used for atomic multi-leg DvP via `MySettlementCoordinator`

**MySettlementCoordinator** (`daml/MySettlementCoordinator.daml`)
- Orchestrates atomic execution of multiple allocation legs
- ExecuteAll choice (requires all senders + receivers + executor)

### Request/Accept Authorization Pattern

Consistent pattern for authorization:

1. **Sender creates request contract** (e.g., `IssuerMintRequest`, `TransferRequest`, `AllocationRequest`)
2. **Admin accepts request** via factory, creating instruction/allocation
3. Ensures both sender and admin authorize the operation

Examples:
- `MyToken.IssuerMintRequest` → Issuer accepts → Mints token
- `MyToken.TransferRequest` → Issuer accepts → Creates `MyTransferInstruction`
- `MyToken.AllocationRequest` → Admin accepts → Creates `MyAllocation`

### Registry API Pattern

`Test.RegistryApi` module provides disclosure helpers:

- `getTransferInstructionDisclosure` - Allows receivers to view/accept/reject transfer instructions
- Used with `submitWithDisclosures` for signatory/observer authorization
- Required because LockedMyToken is not visible to receiver by default

See `Test/TransferInstructionTest.daml` for examples.

## Test Organization

**17 tests total, all passing**, organized by feature area:

### `Test/TestUtils.daml`
Common helpers:
- `allocateTestParties` - Standard party allocation (Issuer, Alice, Bob, Charlie)
- `setupTokenInfrastructure` - Complete infrastructure setup
- `mintTokensTo` - Token minting helper
- `testTimes` - Standard time values
- `createTransferRequest` - Transfer request helper

### `Test/TokenLifecycleTest.daml`
- `testMintTokens` - Basic minting
- `testMintToMultipleReceivers` - Multiple mints

### `Test/TransferInstructionTest.daml`
- `testTransferFactoryAutoLock` - Factory auto-locks
- `testTransferInstructionComplete` - Full transfer flow
- `testTransferInstructionReject` - Receiver rejection
- `testTransferInstructionWithdraw` - Sender withdrawal
- `testTransferInstructionDeadlineExpiry` - Deadline enforcement

### `Test/AllocationAndDvPTest.daml`
- `testAllocationCreate` - Allocation creation
- `testAllocationExecute` - Single allocation execution
- `testDvPTwoLegAtomic` - Atomic two-leg settlement

### `Test/ThreePartyTransferTest.daml`
- `testThreePartyTransfer` - Complete three-party auth flow (Charlie→Alice→Bob)
- `testThreePartyTransferReject` - Receiver rejects transfer
- `testThreePartyTransferWithdraw` - Sender withdraws transfer

### `Test/TransferPreapproval.daml`
- `testTransferPreapproval` - Transfer preapproval pattern

## Key Architectural Patterns

### Why No Lock Choice on MyToken?

Following Splice Amulet pattern, **MyToken does not have a Lock choice**:

1. **MyTokenRules creates LockedMyToken directly** - Declarative, not imperative
2. **Prevents uncontrolled locking** - All locks via issuer-signed MyTokenRules
3. **Type-safe locked state** - LockedMyToken wraps MyToken
4. **Centralized locking authority** - Issuer controls policy

### Wrapped Lock Structure

```daml
template LockedMyToken
  with
    token : MyToken      -- Wrapped token (not duplicated fields)
    lock : TimeLock      -- Lock metadata (holders, expiresAt, context)
  where
    signatory lock.holders, signatory token

    choice Unlock : ContractId MyToken
      controller token.owner :: lock.holders  -- Both parties required
      do create token
```

The `::` operator concatenates controller lists (both owner and issuer required to unlock).

### Three-Party MyToken_Transfer

```daml
choice MyToken_Transfer : TransferResult
  with
    receiver : Party
    amount: Decimal
  controller owner, receiver, issuer  -- All three parties required
```

Prevents any two parties from bypassing issuer authorization.

## Dependencies

Splice CIP-0056 API DARs in `.lib/`:
- `splice-api-token-metadata-v1.dar`
- `splice-api-token-holding-v1.dar`
- `splice-api-token-transfer-instruction-v1.dar`
- `splice-api-token-allocation-v1.dar`
- `splice-api-token-allocation-instruction-v1.dar`

Fetch with `./get-dependencies.sh` before building.

## Important Notes

### Multi-Party Authorization

Many operations require multiple signatures:

- **Creating MyToken**: issuer + owner (both signatories)
- **Archiving MyToken**: issuer + owner (both signatories)
- **MyToken_Transfer**: issuer + owner + receiver (three controllers)
- **Unlocking LockedMyToken**: `token.owner :: lock.holders` (owner + issuer via `::`)
- **Executing allocations**: executor + all senders + all receivers

**Important:** In tests, `submitMulti` is used for convenience. In production, workflow orchestration gathers authorizations. Multi-party requirements are enforced by contract signatories and choice controllers.

### Deadline Validation

All transfers/allocations enforce deadlines:
- `requestedAt` must be in the past
- `executeBefore` / `settleBefore` must be in the future
- Execution fails if deadline passed (see `assertWithinDeadline` in `TwoStepTransfer`)

### Metadata and ExtraArgs

CIP-0056 interfaces use `ExtraArgs` and `Metadata` for extensibility. This implementation uses empty metadata (`MD.emptyMetadata`) and empty choice context. In production, these carry additional settlement context and disclosed contracts.

## References

- Daml v3 (3.3) docs: https://docs.digitalasset.com/build/3.3/index.html
- Daml-Finance Holdings tutorial: https://docs.daml.com/daml-finance/tutorials/getting-started/holdings.html
- CIP-56 spec: https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- Splice token standard: https://github.com/hyperledger-labs/splice/tree/main/token-standard
- Splice Amulet implementation: https://github.com/hyperledger-labs/splice

---

# Part 2: TypeScript SDK (packages/token-sdk)

## Overview

TypeScript SDK for interacting with Canton Network's token and bond systems via the Wallet SDK. Provides helper functions for:
- **Tokens**: Token factories, minting, transferring, and balance queries
- **Bonds**: Fungible bond instruments with full lifecycle management (minting, coupon payments, transfers, redemption)

Built on top of the minimal-token Daml application located in `packages/minimal-token`.

## Development Commands

### Building
- `pnpm build` - Compile TypeScript and bundle with esbuild
- `pnpm build:watch` - Watch mode
- `pnpm tsc` - TypeScript compilation only
- `pnpm esbuild` - esbuild bundling only

### Testing
- `pnpm test` - Run tests once (CI mode)
- `pnpm test:watch` - Watch mode

### Linting
- `pnpm lint` - Check errors
- `pnpm lint:fix` - Auto-fix

### Running Scripts
- `tsx src/uploadDars.ts` - Upload minimal-token DAR to ledger (run once)
- `tsx src/hello.ts` - Basic token operations demo
- `tsx src/testScripts/threePartyTransfer.ts` - Three-party token transfer demonstration
- `tsx src/testScripts/bondLifecycleTest.ts` - Complete bond lifecycle (mint, coupon, transfer, redemption)

### Other Commands
- `pnpm clean` - Remove build artifacts
- `pnpm ledger-schema` - Regenerate OpenAPI types (requires ledger on localhost:7575)
- `pnpm get:minimal-token-id` - Extract package ID from compiled DAR

## Architecture

### Core Components

**SDK Initialization (`src/hello.ts`)**
- Configures `WalletSDKImpl` with localnet defaults
- Connects to Canton ledger and topology service
- Creates external parties (Alice, Bob) using Ed25519 keypairs from seeds
- Allocates parties via signed multi-hashes

**Wrapped SDK Helpers (`src/wrappedSdk/`)**

All helpers follow a consistent pattern with template IDs prefixed by `#minimal-token:`:

**`tokenFactory.ts`** - Token minting
- `createTokenFactory()` / `getLatestTokenFactory()` / `getOrCreateTokenFactory()` - Manage TokenFactory contracts
- `mintToken()` - Exercise Mint choice on TokenFactory

**`tokenRules.ts`** - Token locking rules
- `createTokenRules()` / `getLatestTokenRules()` / `getOrCreateTokenRules()` - Manage MyTokenRules contracts
- Required for transfer operations that need token locking

**`transferFactory.ts`** - Transfer factory management
- `createTransferFactory()` / `getLatestTransferFactory()` / `getOrCreateTransferFactory()` - Manage MyTransferFactory contracts
- Requires rulesCid parameter (from tokenRules)

**`transferRequest.ts`** - Transfer request/accept pattern
- `createTransferRequest()` - Sender creates transfer request
- `acceptTransferRequest()` - Admin accepts request (locks tokens, creates instruction)
- `declineTransferRequest()` - Admin declines request
- `withdrawTransferRequest()` - Sender withdraws request
- `buildTransfer()` - Helper to construct Transfer objects with proper timestamps
- `emptyMetadata()` / `emptyExtraArgs()` - Metadata helpers

**`disclosure.ts`** - Disclosure for three-party transfers
- `getTransferInstruction()` - Query transfer instruction contract
- `getTransferInstructionDisclosure()` - Get disclosure info for receiver
- `formatDisclosedContract()` - Format disclosed contracts for submission
- Note: Full disclosure support requires lower-level LedgerClient API (see Multi-Party Workarounds below)

**`balances.ts`** - Token balance queries
- `getBalances()` / `getBalanceByInstrumentId()` - Query token holdings via tokenStandard SDK

**`transferPreapproval.ts` / `transferPreapprovalProposal.ts`** - Transfer preapproval patterns

**Bond Operations (`src/wrappedSdk/bonds/`)**

The SDK provides comprehensive bond instrument support with 8 wrapper modules:
- **`bondRules.ts`** - Centralized locking authority (issuer-signed, owner-controlled)
- **`factory.ts`** - Bond minting factory (stores notional, couponRate, couponFrequency)
- **`issuerMintRequest.ts`** - Two-step bond minting (receiver proposes, issuer accepts)
- **`lifecycleRule.ts`** - Lifecycle event processing (coupon, redemption) using ledger time
- **`lifecycleEffect.ts`** - Effect query helper (single source of truth for lifecycle events)
- **`lifecycleClaimRequest.ts`** - Claim lifecycle events (holder creates, issuer accepts)
- **`lifecycleInstruction.ts`** - Execute lifecycle events (process coupon or redemption)
- **`transferFactory.ts`** - Bond transfer factory (with bond rules reference)
- **`transferRequest.ts`** - Bond transfer request/accept pattern (supports partial transfers)
- **`transferInstruction.ts`** - Bond transfer acceptance (requires LockedBond disclosure)

**Bond Architecture Highlights:**
- **Fungible Bonds**: Single contract can hold multiple bond units (`notional × amount`)
- **Term Storage**: BondFactory stores bond terms shared by all bonds from that factory
- **Per-Unit Payments**: Coupon = `(notional × rate / frequency) × amount`
- **Partial Transfers**: BondRules automatically splits bonds and creates change
- **Version Tracking**: Bond versions increment with each coupon event
- **Ledger Time Security**: Uses ledger time to prevent time manipulation
- **Three-Party Authorization**: Requires issuer, depository, and owner signatures

For detailed bond documentation, see `packages/token-sdk/CLAUDE.md` Bond Operations section.

**DAR Upload (`src/uploadDars.ts`)**
- Checks if minimal-token package already uploaded via `isPackageUploaded()`
- Uploads DAR from `../minimal-token/.daml/dist/minimal-token-0.1.0.dar`
- Package ID hardcoded, regenerate with `pnpm get:minimal-token-id`

### Canton Ledger Interaction Pattern

Consistent pattern for ledger operations:

1. **Command Creation**: Create `WrappedCommand` (CreateCommand or ExerciseCommand)
2. **Submission**: Use `prepareSignExecuteAndWaitFor()` with:
   - Command array
   - Private key for signing
   - UUID correlation ID
3. **Contract Queries**: Use `activeContracts()` filtered by party and template ID

### Key Architectural Notes

- **External Party Management**: Parties created externally with Ed25519 keypairs, then allocated on-ledger by signing their multi-hash
- **InstrumentId Format**: `{admin: partyId, id: fullInstrumentId}` where fullInstrumentId is typically `partyId#TokenName`
- **UTXO Model**: Token balances tracked as separate contracts; SDK aggregates in `getBalances()`
- **Party Context Switching**: `sdk.setPartyId()` switches context for querying different parties

### Known Issues and Multi-Party Authorization

#### Token Transfer Requires Multi-Party Authorization

The `MyToken` contract defines:
```daml
template MyToken
  with
    issuer : Party
    owner  : Party
    ...
  where
    signatory issuer, owner
```

**Both issuer and owner must sign** any transaction creating a MyToken contract. When transferring:
1. Transfer choice creates new MyToken with receiver as new owner
2. Resulting contract has `signatory issuer, owner` - both must authorize
3. Error message confirms: `requires authorizers [Alice, Bob], but only [Alice] were given`

#### Wallet SDK Limitations

High-level Wallet SDK API does not support multi-party external signing:
- `prepareSignExecuteAndWaitFor()` only accepts single private key
- `prepareSubmission()` uses party set on LedgerController (via `setPartyId()`)
- `actAs` field in commands not exposed at high-level API

#### Multi-Party Transaction Workarounds

To submit multi-party transactions with external signing, use lower-level `LedgerClient` API:

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

1. **Use Internal Parties**: Internal parties use Canton's built-in keys (no interactive submission flow needed)
2. **Redesign Contract**: Modify Daml template to only require current owner's signature for transfers
3. **Implement Two-Step Flow**: Alice initiates, Bob accepts in separate transactions (requires contract redesign)

#### Three-Party Transfer Flow with SDK

For the three-party transfer pattern (Issuer → Sender → Receiver):

1. **Setup Phase** (Issuer as Charlie):
   ```typescript
   const rulesCid = await getOrCreateTokenRules(charlieLedger, charlieKeyPair);
   const transferFactoryCid = await getOrCreateTransferFactory(charlieLedger, charlieKeyPair, rulesCid);
   const tokenFactoryCid = await getOrCreateTokenFactory(charlieLedger, charlieKeyPair, instrumentId);
   ```

2. **Minting Phase** (Alice proposes, Charlie accepts):
   ```typescript
   // Alice creates mint request (requires implementation)
   // Charlie accepts mint request via tokenFactory
   await mintToken(charlieLedger, charlieKeyPair, tokenFactoryCid, { receiver: alice, amount: 100 });
   ```

3. **Transfer Request Phase** (Alice proposes):
   ```typescript
   const transfer = buildTransfer({
       sender: alice,
       receiver: bob,
       amount: 50,
       instrumentId: { admin: charlie, id: instrumentId },
       requestedAt: new Date(Date.now() - 1000), // Past
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

4. **Approval Phase** (Charlie accepts):
   ```typescript
   const requestCid = await getLatestTransferRequest(aliceLedger, charlie);
   await acceptTransferRequest(charlieLedger, charlieKeyPair, requestCid);
   ```

5. **Acceptance Phase** (Bob accepts with disclosure):
   ```typescript
   // Get disclosure from Charlie
   const disclosure = await getTransferInstructionDisclosure(charlieLedger, transferInstructionCid);

   // Bob accepts transfer (requires lower-level API with disclosedContracts support)
   // Full implementation requires LedgerClient API - see Multi-Party Workarounds above
   ```

#### Other TODOs

- Codebase includes TODOs around using `submitCommand` vs `prepareSignExecuteAndWaitFor` with notes about synchronizer submission errors

## Testing

Tests in `src/index.test.ts` using Vitest. Setup in `vitest.setup.ts`.

## Build Output

Builds to three formats:
- `_cjs/` - CommonJS modules
- `_esm/` - ES modules
- `_types/` - TypeScript declaration files

---

## Workspace-Wide Conventions

### Code Organization
- Daml contracts in `packages/minimal-token/daml/`
- TypeScript SDK in `packages/token-sdk/src/`
- Test scripts in `packages/token-sdk/src/testScripts/`
- Shared types in `packages/token-sdk/src/types/`

### Naming Conventions
- Daml templates: PascalCase (e.g., `MyToken`, `MyTokenRules`)
- Daml choices: PascalCase (e.g., `Accept`, `Decline`, `Withdraw`)
- TypeScript functions: camelCase (e.g., `createTokenFactory`, `mintToken`)
- Template IDs: `#minimal-token:ModuleName:TemplateName`

### Testing Strategy
- Daml: Use `daml test` with Script tests in `Test/` directory
- TypeScript: Use Vitest with tests in `src/index.test.ts`
- Integration: Use test scripts in `src/testScripts/` against localnet

### Documentation
- Architecture docs in package-specific CLAUDE.md files
- API reference in code comments
- Examples in test files and demo scripts

## Getting Help

- For Daml questions, refer to https://docs.digitalasset.com/build/3.3/index.html
- For Canton Network questions, refer to Canton documentation
- For Wallet SDK questions, refer to `@canton-network/wallet-sdk` documentation
- For CIP-0056 spec, see https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- Follow the eslint guidelines in @configs/eslint-config/eslint.config.mjs