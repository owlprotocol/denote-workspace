# Denote Capital Monorepo

This monorepo contains a Daml token implementation and TypeScript SDK for building real-world asset tokenization applications on Canton Network. The project includes:

- **`packages/minimal-token/`** - Daml smart contracts implementing CIP-0056 token standard with three-party authorization
- **`packages/token-sdk/`** - TypeScript SDK wrapper providing developer-friendly abstractions for token operations

## Getting Started

```bash
pnpm install
pnpm script:fetch:localnet
pnpm start:localnet
```

---

## Canton Token SDK: TypeScript Wrapper for CIP-0056 Tokens

A TypeScript SDK that simplifies CIP-0056 token operations on Canton Network for tokenizing real-world assets. Wraps complex Daml smart contract interactions into straightforward JavaScript functions. Handles multi-party authorization, token locking, transfer instructions, and atomic settlements. Includes support for both simple tokens and bond instruments with lifecycle management (coupon payments, redemption). Enables developers to build RWA applications using familiar TypeScript instead of requiring deep Daml expertise while maintaining regulatory compliance.

## Key Problem Being Addressed

1. **High complexity barrier** - Building token applications on Canton requires understanding Daml, Canton Wallet SDK, and complex contract orchestration patterns
2. **Repetitive boilerplate** - Common operations like minting or transferring require multiple contract queries, creations, and exercises
3. **Multi-party coordination difficulty** - Three-party authorization flows (issuer, sender, receiver) require manual contract discovery and signature coordination
4. **No standard patterns** - Developers must figure out disclosure, locking, and settlement patterns from scratch
5. **JavaScript ecosystem gap** - No accessible entry point for web developers to build RWA applications on Canton

## Proposed Solution and Concept Highlights

### Core SDK Innovation

Organized namespaced API that simplifies complex workflows into simple function calls:

```typescript
// Initialize with key pair
const wrappedSdk = getWrappedSdkWithKeyPair(sdk, keyPair);

// Setup infrastructure
const rulesCid = await wrappedSdk.tokenRules.getOrCreate();
const factoryCid = await wrappedSdk.tokenFactory.getOrCreate(instrumentId);

// Two-step minting (avoids multi-party signing)
await receiverSdk.issuerMintRequest.create({...});
await issuerSdk.issuerMintRequest.accept(requestCid);

// Query balances (aggregates UTXO model)
const balance = await wrappedSdk.balances.getByInstrumentId({...});

// Transfer with request/accept pattern
await senderSdk.transferRequest.create({...});
await adminSdk.transferRequest.accept(requestCid);

// Disclosure and acceptance
const disclosure = await adminSdk.transferInstruction.getDisclosure(instructionCid);
await receiverSdk.transferInstruction.accept(instructionCid, [disclosure.lockedTokenDisclosure]);
```

### Key Features

- **Organized Namespaces** - Domain-specific grouping: `tokenFactory.*`, `transferRequest.*`, `balances.*`, `bonds.*`
- **Automatic Contract Management** - `getOrCreate()` functions handle contract lifecycle
- **Built-in CIP-0056 Compliance** - Metadata helpers and deadline validation
- **Request/Accept Patterns** - Two-step workflows avoid multi-party signing complexity
- **Disclosure Helpers** - `getDisclosure()` functions format contracts for three-party visibility
- **Balance Aggregation** - Simplifies UTXO-based holdings into single view
- **Bond Lifecycle** - Complete support for coupon payments, transfers, and redemption
- **Type Safety** - Full TypeScript definitions for all contract payloads

### What the SDK Abstracts

- Contract template ID management (`#minimal-token:Module:Template`)
- Party context switching between operations
- Command building (`CreateCommand`, `ExerciseCommand`)
- Contract querying and filtering
- Timestamp and deadline handling
- Token/bond locking and unlocking during transfers
- Disclosure formatting for multi-party authorization

## Tools, Technologies, or Methods

### Current Stack

- **TypeScript** - SDK implementation with organized namespace architecture
- **Canton Wallet SDK** - Low-level ledger interaction (wrapped by this SDK)
- **Daml v3** - Smart contract layer (abstracted away from SDK users)

### SDK Architecture

The wrapper provides two initialization patterns:

```typescript
// Pattern 1: Pass key pair to each call
const wrappedSdk = getWrappedSdk(sdk);
await wrappedSdk.tokenFactory.create(keyPair, instrumentId);

// Pattern 2: Bind key pair upfront (preferred)
const wrappedSdk = getWrappedSdkWithKeyPair(sdk, keyPair);
await wrappedSdk.tokenFactory.create(instrumentId);
```

Organized into domain-specific namespaces:

- **Tokens**: `tokenFactory`, `tokenRules`, `transferFactory`, `balances`
- **Requests**: `issuerMintRequest`, `issuerBurnRequest`, `transferRequest`
- **Instructions**: `transferInstruction`, `transferPreapproval`
- **Bonds**: `bonds.factory`, `bonds.issuerMintRequest`, `bonds.lifecycleRule`, `bonds.transferRequest`, etc.

### Envisioned Enhancements

1. **Lower-level API wrappers** - Full multi-party signing with disclosed contracts support through LedgerClient API
2. **Better frontend integration** - React hooks wrapping the SDK namespaces
3. **Additional asset types** - Equity, commodities, real estate following bond pattern
4. **CLI tooling** - Command-line interface for quick testing and admin operations
5. **REST/GraphQL layers** - HTTP APIs exposing SDK operations for non-TypeScript applications
6. **Batch operations** - Efficient parallel minting and transfers

### Innovation Impact

- Reduces token operation code from ~50 lines to ~5 lines
- Provides organized namespace structure matching domain concepts
- Enables JavaScript developers to build on Canton without Daml knowledge
- Implements request/accept patterns that solve multi-party signing challenges
- Reference implementation of CIP-0056 best practices
- Makes Canton Network accessible for RWA application development
- Complete bond lifecycle support demonstrates extension to complex financial instruments
