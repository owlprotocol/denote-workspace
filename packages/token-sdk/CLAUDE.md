# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript SDK for interacting with Canton Network's token system via the Wallet SDK. The SDK provides helper functions for creating token factories, minting tokens, transferring tokens, and querying balances on a Canton ledger, built on top of the minimal-token Daml application located in the sibling `../minimal-token` directory.

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

**`src/hello.ts`** - Basic token operations
- Simple demo of token factory creation and minting
- Good starting point for understanding the SDK
- Run with: `tsx src/hello.ts`

## Build Output

The package builds to three formats:
- `_cjs/` - CommonJS modules
- `_esm/` - ES modules
- `_types/` - TypeScript declaration files
