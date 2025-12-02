# Bond Instrument Architecture

## Overview

This document describes the architecture of the bond instrument implementation, explaining what contracts exist, why they exist, and how they work together. The implementation follows CIP-0056 standards, Splice patterns, and aligns with daml-finance lifecycle concepts.

## Contract Inventory

**Total: 11 contracts** organized into three categories:

### Core Bond Contracts (5 contracts)

1. **`Bond.daml`** - Core bond template

    - **Purpose**: Represents a bond instrument implementing CIP-0056 `Holding` interface
    - **Key Fields**: `issuer`, `depository`, `owner`, `instrumentId`, `version`, `principal`, `maturityDate`, `couponRate`, `couponFrequency`, `lastEventTimestamp`
    - **Authorization**: `signatory issuer, depository, owner` - all three must authorize creation
    - **Includes**: `LockedBond` template for locked state during transfers/lifecycle events
    - **Reference**: Matches CIP-0056 `Holding` interface pattern, similar to `MyToken` structure

2. **`BondFactory.daml`** - Minting factory

    - **Purpose**: Creates new bonds and manages version creation
    - **Choices**:
        - `Mint`: Creates bond with version "0" (requires `controller issuer, receiver`)
        - `CreateNewVersion`: Creates new bond version after lifecycle events (requires `controller issuer, owner`)
    - **Authorization**: Dual-signatory pattern (issuer + receiver for minting)
    - **Reference**: Matches Splice `AmuletRules_Mint` pattern (both parties must sign)

3. **`BondRules.daml`** - Locking authority

    - **Purpose**: Centralized authority for locking bonds (matches Splice `MyTokenRules` pattern)
    - **Choices**:
        - `BondRules_LockForTransfer`: Locks bond for transfer (whole-unit only)
        - `BondRules_LockForCoupon`: Locks bond for coupon payment processing
        - `BondRules_LockForRedemption`: Locks bond for principal redemption
    - **Authorization**: Issuer-signed, owner-controlled (sender/holder controls choice, issuer signs via rules)
    - **Reference**: Matches Splice pattern - uses disclosure for cross-party visibility, not observable to all

4. **`BondTransferFactory.daml`** - Transfer factory

    - **Purpose**: Implements CIP-0056 `TransferFactory` interface for bond transfers
    - **Functionality**: Auto-locks bonds via `BondRules`, creates `BondTransferInstruction` in pending state
    - **Authorization**: Registry/admin controlled
    - **Reference**: Matches CIP-0056 `TransferFactory` interface, similar to `MyTransferFactory`

5. **`BondTransferInstruction.daml`** - Transfer instruction
    - **Purpose**: Implements CIP-0056 `TransferInstruction` interface for bond transfers
    - **Choices**: `Accept`, `Reject`, `Withdraw` (standard CIP-0056 interface)
    - **Functionality**:
        - Uses two-step transfer pattern (lock → execute/abort)
        - Helpers inlined: `executeTwoStepTransfer`, `abortTwoStepTransfer`, `TwoStepTransfer` data type
    - **Authorization**: Three-party (issuer, sender, receiver)
    - **Reference**: Matches CIP-0056 `TransferInstruction` interface, helpers inlined (matches Splice pattern)

### Request Contracts (2 contracts - Essential for Authorization)

6. **`IssuerMintRequest.daml`** - Mint request

    - **Purpose**: Propose/accept pattern for async minting (receiver proposes, issuer accepts)
    - **Why Essential**: `Bond` has `signatory issuer, depository, owner` - owner MUST authorize. Without this, would require `submitMulti` (synchronous coordination)
    - **Authorization**: Receiver creates request, issuer accepts (both sign in separate transactions)
    - **Reference**: Matches Splice propose/accept pattern, enables async workflows

7. **`TransferRequest.daml`** - Transfer request
    - **Purpose**: Propose/accept pattern for async transfers (sender proposes, issuer accepts)
    - **Why Essential**: Enables async workflows - sender proposes, issuer accepts later (no coordination needed)
    - **Authorization**: Sender creates request, issuer accepts
    - **Reference**: Matches Splice propose/accept pattern, similar to `MyToken.TransferRequest`

### Lifecycle Contracts (4 contracts - Matches Daml-Finance Pattern Exactly)

**Note**: 4 lifecycle contracts is the minimum required and matches daml-finance exactly. Each contract serves a distinct purpose with different authorization requirements that cannot be merged.

8. **`BondLifecycleRule.daml`** - Centralized lifecycle rule

    - **Purpose**: Processes lifecycle events and creates effect contracts (matches daml-finance `Lifecycle.Rule`)
    - **Choices**:
        - `ProcessCouponPaymentEvent`: Creates `BondLifecycleEffect` for coupon payments
        - `ProcessRedemptionEvent`: Creates `BondLifecycleEffect` for redemptions
    - **Authorization**: Issuer and depository signatories (both must sign)
    - **Why Separate**: Different authorization from factory (factory = issuer only, rule = issuer+depository)
    - **Reference**: Matches daml-finance centralized lifecycle rule pattern - single source of truth for lifecycle events

9. **`BondLifecycleEffect.daml`** - Effect contracts

    - **Purpose**: Describes lifecycle events that holders can claim (matches daml-finance `Effect`)
    - **Key Fields**: `eventType` (CouponPayment | Redemption), `targetInstrumentId`, `targetVersion`, event-specific amounts/dates
    - **Authorization**: Issuer and depository signatories
    - **Why Separate**: Multiple holders reference the same effect contract (single source of truth)
    - **Reference**: Matches daml-finance effect pattern - version-tied to prevent double-claiming

10. **`BondLifecycleClaim.daml`** - Claim processor

    - **Purpose**: Processes effect claims and creates lifecycle instructions (matches daml-finance `Rule.Claim`)
    - **Functionality**:
        - Holder creates `BondLifecycleClaimRequest` → Issuer accepts
        - On accept: locks bond, creates `BondLifecycleInstruction`, creates currency transfer instruction
        - Factory logic inlined (matches daml-finance where `Rule.Claim` directly creates settlement instructions)
    - **Authorization**: Holder creates request, issuer accepts (propose/accept pattern)
    - **Why Separate**: Different authorization flow from instruction (claim = propose/accept, instruction = execute)
    - **Reference**: Matches daml-finance `Rule.Claim` pattern - directly creates settlement instructions

11. **`BondLifecycleInstruction.daml`** - Lifecycle instruction
    - **Purpose**: Executes lifecycle events (matches daml-finance `SettlementInstruction`)
    - **Choices**: `Process` (holder-controlled), `Abort` (holder-controlled)
    - **Functionality**:
        - For coupon payments: unlocks bond, creates new version, archives old bond
        - For redemption: unlocks bond, archives bond (no new version)
    - **Authorization**: Issuer signatory, holder observer (holder controls `Process` choice)
    - **Why Separate**: Different authorization from claim (instruction = holder executes after acceptance)
    - **Reference**: Matches daml-finance settlement instruction pattern

## Architecture Flow

### Minting Flow

```
Receiver → IssuerMintRequest → Issuer accepts → BondFactory.Mint → Bond created
```

-   **Authorization**: Both receiver and issuer must sign (via request/accept pattern)

### Transfer Flow

```
Sender → TransferRequest → Issuer accepts → BondTransferFactory.Transfer →
BondTransferInstruction (pending) → Receiver accepts → Transfer complete
```

-   **Authorization**: Three-party (issuer, sender, receiver)

### Lifecycle Flow (Coupon Payment)

```
Issuer → BondLifecycleRule.ProcessCouponPaymentEvent → BondLifecycleEffect created →
Holder → BondLifecycleClaimRequest → Issuer accepts →
BondLifecycleInstruction created + Currency transfer instruction created →
Holder → BondLifecycleInstruction.Process → New bond version created →
Holder → Currency transfer instruction accepted → Currency received
```

-   **Authorization**: Issuer creates effect, holder claims, issuer accepts, holder processes

### Lifecycle Flow (Redemption)

```
Issuer → BondLifecycleRule.ProcessRedemptionEvent → BondLifecycleEffect created →
Holder → BondLifecycleClaimRequest → Issuer accepts →
BondLifecycleInstruction created + Currency transfer instruction created →
Holder → BondLifecycleInstruction.Process → Bond archived →
Holder → Currency transfer instruction accepted → Principal received
```

-   **Authorization**: Same as coupon payment

## Design Decisions

### Why 11 Contracts?

**Core (5)**: Essential CIP-0056 compliance and basic functionality

-   Bond, BondFactory, BondRules, BondTransferFactory, BondTransferInstruction

**Request (2)**: Essential for authorization and async workflows

-   Cannot mint/transfer without receiver authorization (Daml requirement)
-   Enables async propose/accept pattern (no synchronous coordination needed)

**Lifecycle (4)**: Matches daml-finance pattern exactly

-   Rule → Effect → Claim → Instruction (same as daml-finance)
-   **Efficiency**: 4 contracts is the minimum required - each contract has distinct authorization requirements and purposes that cannot be merged without losing functionality or breaking the pattern

### Why Request Contracts Are Essential

**Authorization Constraint**:

-   `Bond` has `signatory issuer, depository, owner` - owner MUST sign
-   `BondFactory.Mint` has `controller issuer, receiver` - both MUST sign
-   Without request contracts, would require `submitMulti` (synchronous coordination)

**Async Workflows**:

-   Request/accept pattern enables: receiver proposes → issuer accepts later
-   Critical for real-world financial systems (parties don't coordinate timing)

### Why Lifecycle Contracts Match Daml-Finance

**Daml-Finance Pattern** (4 contracts):

1. `Lifecycle.Rule` → Creates effects
2. `Effect` → Describes lifecycle consequences
3. `Rule.Claim` → Processes claims, directly creates settlement instructions
4. `SettlementInstruction` → Executes asset movements

**Our Pattern** (4 contracts):

1. `BondLifecycleRule` → Creates effects ✅
2. `BondLifecycleEffect` → Describes lifecycle consequences ✅
3. `BondLifecycleClaim` → Processes claims, directly creates instructions ✅
4. `BondLifecycleInstruction` → Executes asset movements ✅

**Perfect Alignment**: Factory logic merged into `BondLifecycleClaim` (matches daml-finance where `Rule.Claim` directly creates settlement instructions)

## Key Patterns

### Three-Party Authorization

-   **Minting**: Issuer + Receiver
-   **Transfers**: Issuer + Sender + Receiver
-   **Lifecycle**: Issuer + Holder (with depository co-signatory)

### Two-Step Transfer Pattern

-   **Prepare (Lock)**: Via `BondRules_LockForTransfer` - archives bond, creates `LockedBond`
-   **Execute (Transfer)**: Via `executeTwoStepTransfer` - validates deadline, unlocks, creates new bond for receiver
-   **Abort (Unlock)**: Via `abortTwoStepTransfer` - unlocks bond back to sender

### Effect-Based Lifecycle

-   **Single Source of Truth**: Issuer creates one effect for all holders
-   **Version-Tied**: Effects tied to specific bond version (prevents double-claiming)
-   **Gradual Migration**: Holders claim effects at their own pace

### Disclosure Pattern

-   **Cross-Party Visibility**: Uses disclosure for contracts not directly observable
-   **Security**: Only necessary parties see contracts when needed

## References

-   **CIP-0056**: [CIP-0056 Specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md)
-   **Daml-Finance**: [Lifecycling Concepts](https://docs.daml.com/daml-finance/concepts/lifecycling.html), [Fixed Rate Bond Tutorial](https://docs.daml.com/daml-finance/tutorials/lifecycling/fixed-rate-bond.html)
-   **Splice**: Amulet Reference Implementation (in `splice/` directory)
