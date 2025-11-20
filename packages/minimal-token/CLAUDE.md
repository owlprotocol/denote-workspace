# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **placeholder** Canton CIP-0056 token implementation that demonstrates the standard token patterns: holdings view, FOP (Free of Payment) transfer instructions, and DvP (Delivery versus Payment) allocations. The implementation follows patterns similar to Splice's Amulet token standard.

**Note:** This is not production-ready. Many modules contain TODOs and commented cues where real CIP-0056 interfaces should be wired.

## Build and Test Commands

```bash
# Install dependencies (fetches Splice API DARs)
./get-dependencies.sh

# Build the project (with required warning suppressions)
daml build -Wno-template-interface-depends-on-daml-script -Wno-unused-dependency

# Or use npm scripts
npm run build

# Run all tests
daml test
# Or: npm test

# Start a local Canton ledger with the project
daml start
# Or: npm start
```

## Architecture Overview

### Token Model

The implementation uses a two-state token model following the Splice Amulet pattern:

1. **MyToken** - Unlocked tokens that can be freely controlled by the owner
2. **LockedMyToken** - Wraps a MyToken value with lock metadata (expiry, holders, context)

Both implement the `Splice.Api.Token.HoldingV1.Holding` interface to comply with CIP-0056.

**Key Design Decision**: LockedMyToken contains `token : MyToken` (not duplicated fields). This wrapped structure ensures type safety and follows the Amulet reference implementation.

### Three-Party Authorization

All token transfers require authorization from **three parties**:

1. **Issuer** - Signs MyTokenRules, authorizes locking, controller on MyToken_Transfer
2. **Sender (Owner)** - Controls lock operation via MyTokenRules, controller on transfer choices
3. **Receiver** - Must accept transfer instructions with disclosure

This prevents any two parties from bypassing the issuer's oversight of token movements.

### Core Workflow Pattern: Two-Step Transfer

All transfer and allocation operations follow a consistent two-step pattern implemented in `MyToken.TwoStepTransfer`:

1. **Prepare (Lock)**: Via `prepareTwoStepTransfer` - locks input holdings using `MyTokenRules`
2. **Execute (Transfer)**: Via `executeTwoStepTransfer` - validates deadline, unlocks, transfers to receiver
3. **Abort (Unlock)**: Via `abortTwoStepTransfer` - unlocks tokens back to sender if rejected/withdrawn

This pattern is used by both:
- **Transfer Instructions** (FOP transfers between parties)
- **Allocations** (DvP settlement legs)

### Key Components

**MyTokenFactory** (`daml/MyTokenFactory.daml`)
- Minting new tokens
- Requires both issuer and receiver signatures (dual-signatory pattern)

**MyTokenRules** (`daml/MyTokenRules.daml`)
- Centralized locking authority following Amulet pattern
- **Creates LockedMyToken directly** (no Lock choice on MyToken template)
- Handles splitting tokens when partial amounts are needed, returns optional change CID
- Controller is the token owner (sender), signatory is the issuer
- This pattern prevents uncontrolled locking - all locks go through issuer-signed rules

**MyTransferFactory** (`daml/MyTransferFactory.daml`)
- Implements `Splice.Api.Token.TransferInstructionV1.TransferFactory`
- Auto-locks tokens via `prepareTwoStepTransfer`
- Creates `MyTransferInstruction` in pending state
- Follows request/accept pattern for authorization

**MyTransferInstruction** (`daml/MyTokenTransferInstruction.daml`)
- Implements `Splice.Api.Token.TransferInstructionV1.TransferInstruction`
- Supports Accept (complete transfer), Reject (sender gets tokens back), Withdraw (sender cancels)
- Delegates to `TwoStepTransfer` helpers

**MyAllocationFactory** (`daml/MyAllocationFactory.daml`)
- Implements `Splice.Api.Token.AllocationInstructionV1.AllocationFactory`
- Auto-locks tokens for DvP settlement legs
- Creates `MyAllocation` directly (immediately completed state)

**MyAllocation** (`daml/MyAllocation.daml`)
- Implements `Splice.Api.Token.AllocationV1.Allocation`
- Supports ExecuteTransfer (complete settlement), Withdraw/Cancel (return to sender)
- Used for atomic multi-leg DvP via `MySettlementCoordinator`

**MySettlementCoordinator** (`daml/MySettlementCoordinator.daml`)
- Orchestrates atomic execution of multiple allocation legs
- ExecuteAll choice exercises all legs atomically (requires all senders + receivers + executor)

### Request/Accept Pattern

The codebase uses a consistent request/accept authorization pattern:

1. **Sender creates request contract** (e.g., `IssuerMintRequest`, `TransferRequest`, `AllocationRequest`)
2. **Admin accepts request** via factory, creating the instruction/allocation
3. This ensures both sender and admin authorize the operation

Examples:
- `MyToken.IssuerMintRequest` -> Issuer accepts -> Mints token
- `MyToken.TransferRequest` -> Issuer accepts -> Creates `MyTransferInstruction`
- `MyToken.AllocationRequest` -> Admin accepts -> Creates `MyAllocation`

### Registry API Pattern

The `Test.RegistryApi` module provides disclosure helpers for cross-party visibility:

- `getTransferInstructionDisclosure` - Allows receivers to view and accept/reject transfer instructions
- Used with `submitWithDisclosures` to handle signatory/observer authorization
- Required because LockedMyToken is not visible to receiver by default

See `Test/TransferInstructionTest.daml` for usage examples.

## Dependencies

The project depends on Splice CIP-0056 API DARs located in `.lib/`:
- `splice-api-token-metadata-v1.dar`
- `splice-api-token-holding-v1.dar`
- `splice-api-token-transfer-instruction-v1.dar`
- `splice-api-token-allocation-v1.dar`
- `splice-api-token-allocation-instruction-v1.dar`

Fetch these using `./get-dependencies.sh` before building.

## Important Notes

### Multi-Party Authorization

Many operations require multiple signatures due to Daml's signatory requirements:

- **Creating MyToken**: Requires issuer + owner (both signatories)
- **Archiving MyToken**: Requires issuer + owner (both signatories)
- **MyToken_Transfer**: Requires issuer + owner + receiver (three controllers)
- **Unlocking LockedMyToken**: Requires `token.owner :: lock.holders` (both owner and issuer via `::` list concatenation)
- **Executing allocations**: Requires executor + all senders + all receivers

**Important**: In tests, `submitMulti` is used as a convenience to provide all required signatures. In production, the workflow orchestration layer handles gathering these authorizations. The multi-party requirements are enforced by contract signatories and choice controllers, not by the submission method.

### Deadline Validation

All transfer and allocation operations enforce deadlines:
- `requestedAt` must be in the past
- `executeBefore` / `settleBefore` must be in the future
- Execution fails if deadline has passed (see `assertWithinDeadline` in `TwoStepTransfer`)

### Metadata and ExtraArgs

CIP-0056 interfaces use `ExtraArgs` and `Metadata` extensively for extensibility. This implementation uses empty metadata (`MD.emptyMetadata`) and empty choice context. In production, these would carry additional settlement context and disclosed contracts.

## Test Organization

The test suite is organized by feature area for clarity and maintainability (**17 tests total, all passing**):

### `Test/TestUtils.daml`
Common helpers to reduce test duplication:
- `allocateTestParties` - Standard party allocation (Issuer, Alice, Bob, Charlie)
- `setupTokenInfrastructure` - Complete infrastructure setup (rules, factories)
- `mintTokensTo` - Token minting helper with request/accept
- `testTimes` - Standard time values (now, past, future)
- `createTransferRequest` - Transfer request helper

### `Test/TokenLifecycleTest.daml`
- `testMintTokens` - Basic token minting
- `testMintToMultipleReceivers` - Multiple independent mints

### `Test/TransferInstructionTest.daml`
- `testTransferFactoryAutoLock` - Factory auto-locks tokens
- `testTransferInstructionComplete` - Full transfer flow
- `testTransferInstructionReject` - Receiver rejection
- `testTransferInstructionWithdraw` - Sender withdrawal
- `testTransferInstructionDeadlineExpiry` - Deadline enforcement

### `Test/AllocationAndDvPTest.daml`
- `testAllocationCreate` - Allocation creation and locking
- `testAllocationExecute` - Single allocation execution
- `testDvPTwoLegAtomic` - Atomic two-leg settlement

### `Test/ThreePartyTransferTest.daml`
- `testThreePartyTransfer` - Complete three-party auth flow (Charlie→Alice→Bob)
- `testThreePartyTransferReject` - Receiver rejects transfer
- `testThreePartyTransferWithdraw` - Sender withdraws transfer

### `Test/TransferPreapproval.daml`
- `testTransferPreapproval` - Transfer preapproval pattern

### `Scripts/Holding.daml`
- `setupHolding` - Utility function for setting up holdings

## Key Architectural Patterns

### Why No Lock Choice on MyToken?

Following the Splice Amulet pattern, **MyToken does not have a Lock choice**. Instead:

1. **MyTokenRules creates LockedMyToken directly** - Declarative locking, not imperative
2. **Prevents uncontrolled locking** - All locks go through issuer-signed MyTokenRules
3. **Type-safe locked state** - LockedMyToken wraps MyToken, not field duplication
4. **Centralized locking authority** - Issuer controls locking policy via MyTokenRules

This design ensures the issuer maintains oversight of all token locking operations.

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

The `::` operator concatenates controller lists, requiring both owner and issuer to unlock.

### Three-Party MyToken_Transfer

```daml
choice MyToken_Transfer : TransferResult
  with
    receiver : Party
    amount: Decimal
  controller owner, receiver, issuer  -- All three parties required
```

This prevents any two parties from bypassing the issuer's authorization.

### Request/Accept Authorization Gate

All factory operations use a request/accept pattern:

1. Sender creates request contract (e.g., `TransferRequest`, `AllocationRequest`)
2. Issuer/admin accepts request via factory
3. Factory locks tokens and creates instruction/allocation

This ensures both parties explicitly authorize the operation before tokens are locked.

## Documentation

- **`README.md`** - Project overview, quick start, and architecture highlights
- **`TRANSFER.md`** - In-depth transfer instruction authorization flow and patterns
- **`CLAUDE.md`** - This file, detailed architecture guide for AI assistants

## References

- Daml v3 (3.3) docs: https://docs.digitalasset.com/build/3.3/index.html
- Daml-Finance Holdings tutorial: https://docs.daml.com/daml-finance/tutorials/getting-started/holdings.html
- CIP-56 spec: https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- Splice token standard: https://github.com/hyperledger-labs/splice/tree/main/token-standard
- Splice Amulet implementation: https://github.com/hyperledger-labs/splice (reference implementation)
