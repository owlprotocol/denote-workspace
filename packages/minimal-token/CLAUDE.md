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

The implementation uses a two-state token model:

1. **MyToken** - Unlocked tokens that can be freely controlled by the owner
2. **LockedMyToken** - Tokens locked for pending transfers/settlements with expiry deadlines

Both implement the `Splice.Api.Token.HoldingV1.Holding` interface to comply with CIP-0056.

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
- Utility contract for locking holdings atomically
- Handles splitting tokens when partial amounts are needed
- Controller is the token owner (sender), signatory is the issuer

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

- `getTransferInstructionDisclosure` - Allows receivers to view and accept transfer instructions
- Used with `submitWithDisclosures` to handle signatory/observer authorization

See: `Test/Scripts.daml:276-281` for usage example.

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

- **Creating MyToken**: Requires issuer + owner
- **Archiving MyToken**: Requires issuer + owner
- **Unlocking LockedMyToken**: Requires holders (typically includes issuer)
- **Executing allocations**: Requires executor + all senders + all receivers

In tests, use `submitMulti` or the request/accept pattern to handle multi-party authorization correctly.

### Deadline Validation

All transfer and allocation operations enforce deadlines:
- `requestedAt` must be in the past
- `executeBefore` / `settleBefore` must be in the future
- Execution fails if deadline has passed (see `assertWithinDeadline` in `TwoStepTransfer`)

### Metadata and ExtraArgs

CIP-0056 interfaces use `ExtraArgs` and `Metadata` extensively for extensibility. This implementation uses empty metadata (`MD.emptyMetadata`) and empty choice context. In production, these would carry additional settlement context and disclosed contracts.

## Test Scripts

Comprehensive test scenarios in `Test/Scripts.daml`:

- `testMintAndLockScript` - Basic minting and locking
- `testTransferFactoryFlow` - End-to-end FOP transfer with accept
- `testTransferInstructionReject` - Receiver rejects transfer
- `testTransferInstructionWithdraw` - Sender withdraws transfer
- `testTransferInstructionDeadlineExpiry` - Deadline enforcement
- `testAllocationFactoryFlow` - Single-leg allocation and execute
- `testDvPAtomicScript` - Multi-leg atomic DvP settlement

## References

- Daml v3 (3.3) docs: https://docs.digitalasset.com/build/3.3/index.html
- Daml-Finance Holdings tutorial: https://docs.daml.com/daml-finance/tutorials/getting-started/holdings.html
- CIP-56 spec: https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- Splice token standard: https://github.com/hyperledger-labs/splice/tree/main/token-standard
