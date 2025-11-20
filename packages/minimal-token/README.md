# Minimal CIP-0056 Token Implementation

A reference implementation of Canton CIP-0056 token standard demonstrating holdings view, Free-of-Payment (FOP) transfer instructions, and Delivery versus Payment (DvP) allocations. Follows patterns from the Splice Amulet token standard.

## Overview

This implementation demonstrates **three-party authorization** for token transfers where sender, receiver, and issuer all participate in the authorization flow. The architecture follows the Splice Amulet reference implementation with proper locking mechanisms, two-step transfers, and atomic multi-leg settlements.

## Key Features

### Token Model
- **`MyToken`** - Unlocked tokens with full owner control
- **`LockedMyToken`** - Wrapped locked tokens with expiry deadlines
- **`TimeLock`** - Lock metadata following Amulet pattern
- **Three-party authorization** - All transfers require issuer + sender + receiver

### Transfer Mechanisms
- **Two-step transfer pattern** - Lock (prepare) → Execute/Abort
- **Transfer instructions** - FOP transfers with accept/reject/withdraw
- **Allocations** - DvP settlement legs with atomic execution
- **Settlement coordinator** - Multi-leg atomic DvP settlements

### Infrastructure
- **`MyTokenRules`** - Centralized locking authority (issuer-signed)
- **`MyTransferFactory`** - Auto-locks tokens via rules
- **`MyAllocationFactory`** - Creates allocations for DvP
- **Request/Accept pattern** - Sender proposes, issuer approves

## Quick Start

### 1. Install Dependencies
```bash
./get-dependencies.sh
```

### 2. Build the Project
```bash
daml build -Wno-template-interface-depends-on-daml-script -Wno-unused-dependency
# Or use npm script
npm run build
```

### 3. Run Tests
```bash
daml test
# Or use npm script
npm test
```

**All 17 tests should pass**, covering minting, transfers, allocations, and DvP scenarios.

### 4. Start Local Ledger
```bash
daml start
# Or use npm script
npm start
```

## Project Structure

```
daml/
├── MyToken.daml                       # Core token templates (unlocked & locked)
├── MyTokenFactory.daml                # Token minting with request/accept
├── MyTokenRules.daml                  # Locking authority (issuer-signed)
├── MyTransferFactory.daml             # Transfer instruction factory
├── MyTokenTransferInstruction.daml    # FOP transfer instructions
├── MyAllocationFactory.daml           # DvP allocation factory
├── MyAllocation.daml                  # DvP settlement legs
├── MySettlementCoordinator.daml       # Multi-leg atomic execution
├── MyToken/
│   ├── TwoStepTransfer.daml          # Prepare/Execute/Abort helpers
│   ├── TransferRequest.daml          # Request/accept pattern for transfers
│   └── AllocationRequest.daml        # Request/accept pattern for allocations
└── Test/
    ├── TestUtils.daml                 # Common test helpers and setup
    ├── TokenLifecycleTest.daml        # Minting tests
    ├── TransferInstructionTest.daml   # FOP transfer tests (5 scenarios)
    ├── AllocationAndDvPTest.daml      # DvP settlement tests (3 scenarios)
    ├── ThreePartyTransferTest.daml    # Three-party authorization tests
    ├── TransferPreapproval.daml       # Pre-approval pattern tests
    └── RegistryApi.daml               # Disclosure helpers
```

## Test Organization

The test suite is organized by feature area for clarity and maintainability:

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

### `Test/TestUtils.daml`
Common helpers to reduce test duplication:
- `allocateTestParties` - Standard party allocation
- `setupTokenInfrastructure` - Complete infrastructure setup
- `mintTokensTo` - Token minting helper
- `testTimes` - Standard time values
- `createTransferRequest` - Transfer request helper

## Architecture Highlights

### Three-Party Authorization Flow

Every transfer requires authorization from all three parties:

1. **Sender** - Creates `TransferRequest`, controls lock operation
2. **Issuer** - Accepts request via `MyTransferFactory`, signs `MyTokenRules`
3. **Receiver** - Accepts `TransferInstruction` with disclosure

See `TRANSFER.md` for detailed authorization flow documentation.

### Token Locking Pattern (Following Amulet)

Unlike the naive approach of adding a `Lock` choice to tokens, this implementation follows Splice's pattern:

- **No Lock choice on MyToken** - Prevents uncontrolled locking
- **LockedMyToken wraps MyToken** - Type-safe relationship
- **MyTokenRules creates locks** - Centralized locking authority
- **Unlock requires both parties** - Owner + holders must authorize

### Key Design Decisions

1. **Removed `MyToken.Lock` choice** - Locks created declaratively by `MyTokenRules`
2. **Three-party `MyToken_Transfer`** - Requires `issuer + owner + receiver`
3. **Wrapped lock structure** - `LockedMyToken` embeds `MyToken` value
4. **Request/Accept pattern** - Gates all factory operations
5. **Disclosure-based visibility** - Enables cross-party authorization

## Documentation

- **`README.md`** - This file, project overview and quick start
- **`CLAUDE.md`** - Detailed architecture guide for AI assistants
- **`TRANSFER.md`** - In-depth transfer instruction authorization flow
- **`daml/`** - Source code with inline documentation

## References

- **Daml v3 (3.3)** - https://docs.digitalasset.com/build/3.3/index.html
- **Daml-Finance Holdings** - https://docs.daml.com/daml-finance/tutorials/getting-started/holdings.html
- **CIP-56 Specification** - https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md
- **Splice Token Standard** - https://github.com/hyperledger-labs/splice/tree/main/token-standard
- **Splice Amulet Implementation** - Reference implementation this project follows

## Contributing

This is a reference implementation demonstrating best practices for CIP-0056 token implementations. When adapting for production use:

1. Review all `TODO` comments in the code
2. Implement proper access control for your use case
3. Add comprehensive error handling
4. Conduct security audits
5. Test extensively with edge cases
6. Consider adding monitoring and metrics

## License

This project follows the same license as the Splice token standard.
