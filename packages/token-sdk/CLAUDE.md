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
- `tsx src/uploadDars.ts` - Upload the minimal-token DAR to the ledger (run once before using hello.ts)
- `tsx src/hello.ts` - Main demo script showing token operations

### Other Commands
- `pnpm clean` - Remove build artifacts
- `pnpm ledger-schema` - Regenerate OpenAPI types from local ledger (requires ledger running on localhost:7575)
- `pnpm get:minimal-token-id` - Extract package ID from compiled DAR file

## Architecture

### Core Components

**SDK Initialization (`src/hello.ts`)**
- Configures `WalletSDKImpl` with localnet defaults for auth, ledger, and token standard
- Connects to the Canton ledger and topology service
- Creates external parties (Alice, Bob) using Ed25519 keypairs generated from seeds
- Allocates parties on the ledger via signed multi-hashes

**Helper Functions (`src/helpers.ts`)**
- `createTokenFactory()` / `getLatestTokenFactory()` / `getOrCreateTokenFactory()` - Manage TokenFactory contracts that can mint tokens
- `mintToken()` - Exercise the Mint choice on a TokenFactory contract
- `transferToken()` - Exercise the Transfer choice on a MyToken contract
- `getBalances()` / `getBalanceByInstrumentId()` - Query token holdings via the tokenStandard SDK
- Template IDs are prefixed with `#minimal-token:` (e.g., `#minimal-token:MyTokenFactory:MyTokenFactory`)

**DAR Upload (`src/uploadDars.ts`)**
- Checks if the minimal-token package is already uploaded via `isPackageUploaded()`
- Uploads the DAR file from `../minimal-token/.daml/dist/minimal-token-0.1.0.dar` if not present
- Package ID is hardcoded but can be regenerated with `pnpm get:minimal-token-id`

### Canton Ledger Interaction Pattern

The SDK uses a consistent pattern for ledger operations:

1. **Command Creation**: Create a `WrappedCommand` (CreateCommand or ExerciseCommand)
2. **Submission**: Use `prepareSignExecuteAndWaitFor()` with:
   - Command array
   - Private key for signing
   - UUID correlation ID
3. **Contract Queries**: Use `activeContracts()` filtered by party and template ID

### Key Architectural Notes

- **External Party Management**: Parties are created externally with Ed25519 keypairs, then allocated on-ledger by signing their multi-hash
- **InstrumentId Format**: Tokens are identified by `{admin: partyId, id: fullInstrumentId}` where fullInstrumentId is typically `partyId#TokenName`
- **UTXO Model**: Token balances are tracked as separate contracts (UTXOs); the SDK aggregates them in `getBalances()`
- **Party Context Switching**: `sdk.setPartyId()` is used to switch context when querying different parties' holdings

### Known Issues and Multi-Party Authorization

#### Token Transfer Requires Multi-Party Authorization

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

This means **both the issuer and owner must sign** any transaction that creates a MyToken contract. When transferring tokens:
1. The Transfer choice creates a new MyToken contract with the receiver as the new owner
2. Since the resulting contract has `signatory issuer, owner`, both Alice (issuer) and Bob (new owner) must authorize the transaction
3. The error message confirms this: `requires authorizers [Alice, Bob], but only [Alice] were given`

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
2. **Redesign the Contract**: Modify the Daml template to only require the current owner's signature for transfers
3. **Implement a Two-Step Flow**: Have Alice initiate and Bob accept in separate transactions (requires contract redesign)

#### Other TODOs

- The codebase includes TODOs around using `submitCommand` vs `prepareSignExecuteAndWaitFor` with notes about synchronizer submission errors

## Testing

Tests are located in `src/index.test.ts` and use Vitest. The test setup is in `vitest.setup.ts`.

## Build Output

The package builds to three formats:
- `_cjs/` - CommonJS modules
- `_esm/` - ES modules
- `_types/` - TypeScript declaration files
