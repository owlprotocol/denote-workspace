# Transfer Instructions in Splice CIP-0056

## Why Transfer Instructions Are Used

Transfer instructions provide a **two-phase commit pattern** for token transfers that enables:

1. **Multi-party authorization** - Sender, receiver, and issuer all participate in the transfer
2. **Atomic state management** - Tokens are locked during the pending phase to prevent double-spending
3. **Rejection capability** - Receivers can decline unwanted transfers
4. **Deadline enforcement** - Transfers must complete within a specified timeframe or expire
5. **Disclosure-based visibility** - Receivers can see and accept transfers without being observers on the original token

This pattern is essential for regulated financial workflows where:
- Issuers need to maintain control over token transfers
- Receivers need to explicitly accept incoming transfers
- Transfers need to be reversible before acceptance
- Multi-leg atomic settlements (DvP) need coordination

## How Transfer Instructions Work

### The Three Parties

1. **Sender** - Current owner of tokens, initiates the transfer
2. **Receiver** - Destination party, must accept the transfer
3. **Issuer/Admin** - Token administrator, gates operations and provides disclosure

### The Transfer Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: PREPARE (Sender + Issuer)                         │
└─────────────────────────────────────────────────────────────┘

1. Sender creates TransferRequest
   - Signatories: sender
   - Observers: issuer (admin)
   - Purpose: Propose transfer to admin

2. Issuer accepts TransferRequest
   - Controller: issuer
   - Calls: TransferFactory_Transfer
   - Effect: Auto-locks tokens via MyTokenRules

3. Tokens are locked via MyTokenRules_LockForTransfer
   - Controller: sender
   - Signatories: sender + issuer (rules)
   - Effect: MyToken → LockedMyToken
   - Locked token holders: [issuer]

4. MyTransferInstruction is created
   - Signatories: issuer + sender
   - Observers: receiver
   - Status: TransferPendingReceiverAcceptance
   - Contains: reference to LockedMyToken

State after Phase 1:
✓ Original MyToken archived
✓ LockedMyToken created (visible to issuer)
✓ MyTransferInstruction created (visible to receiver)
✓ Tokens cannot be double-spent


┌─────────────────────────────────────────────────────────────┐
│ PHASE 2A: ACCEPT (Receiver + Issuer + Sender)              │
└─────────────────────────────────────────────────────────────┘

5. Issuer provides disclosure
   - Issuer queries LockedMyToken contract
   - Issuer gets disclosure for locked token
   - Disclosure shared with receiver

6. Receiver accepts via TransferInstruction_Accept
   - Controller: receiver
   - Uses: submitWithDisclosures [disclosure]
   - Calls: executeTwoStepTransfer

7. executeTwoStepTransfer performs atomic transfer
   a. Validate deadline (executeBefore must be future)
   b. Unlock LockedMyToken
      - Controller: holders [issuer]
      - Signatories: issuer + sender
      - Returns: unlocked MyToken
   c. Archive unlocked MyToken
      - Signatories: issuer + sender
   d. Create new MyToken(owner=receiver)
      - Signatories: issuer + receiver
      - Purpose: Transfer complete

State after Phase 2A:
✓ LockedMyToken archived
✓ MyTransferInstruction archived
✓ Original sender's MyToken archived
✓ New receiver's MyToken created
✓ Transfer complete


┌─────────────────────────────────────────────────────────────┐
│ PHASE 2B: REJECT/WITHDRAW (Sender or Receiver)             │
└─────────────────────────────────────────────────────────────┘

Alternative: Receiver rejects or Sender withdraws

5. Receiver exercises TransferInstruction_Reject
   OR Sender exercises TransferInstruction_Withdraw
   - Calls: abortTwoStepTransfer

6. abortTwoStepTransfer unlocks tokens to sender
   - Unlock LockedMyToken
   - Return MyToken to sender
   - Archive TransferInstruction

State after Phase 2B:
✓ LockedMyToken archived
✓ MyTransferInstruction archived
✓ MyToken returned to sender
✓ Transfer cancelled
```

## Key Authorization Points

| Step | Choice | Controller | Signatories Required | Purpose |
|------|--------|-----------|---------------------|---------|
| 1 | Create TransferRequest | sender | sender | Propose transfer |
| 2 | TransferRequest.Accept | issuer | issuer | Approve transfer |
| 3 | MyTokenRules_LockForTransfer | sender | sender + issuer | Lock tokens |
| 4 | Create MyTransferInstruction | issuer | issuer + sender | Create pending transfer |
| 5 | TransferInstruction_Accept | receiver | issuer + sender + receiver | Complete transfer |
| 6 | Unlock LockedMyToken | issuer | issuer + sender | Unlock during accept |
| 7 | Create receiver MyToken | issuer | issuer + receiver | Final transfer |

## The Three-Party Authorization Model

Every transfer requires all three parties to authorize at different stages:

**Sender Authorization:**
- Creates TransferRequest (step 1)
- Controls lock operation (step 3)
- Signatory on TransferInstruction (step 4)
- Signatory for unlock (step 6)

**Issuer Authorization:**
- Accepts TransferRequest (step 2)
- Signatory on MyTokenRules (step 3)
- Signatory on TransferInstruction (step 4)
- Controls unlock operation (step 6)
- Signatory for receiver token creation (step 7)

**Receiver Authorization:**
- Accepts TransferInstruction (step 5)
- Signatory on received MyToken (step 7)

**Result:** No single party can unilaterally force a transfer. All three must cooperate.

## Token Locking Mechanics

### Lock (Prepare Phase)

```daml
nonconsuming choice MyTokenRules_LockForTransfer
  with
    sender : Party
    inputHoldingCid : ContractId H.Holding
    desiredAmount : Decimal
    transferBefore : Time
    contextText : Text
  controller sender
```

Key behaviors:
- **Atomic** - Archives input MyToken, creates LockedMyToken in one transaction
- **Splitting** - If input > desired amount, creates change token for sender
- **Deadline** - Sets `expiresAt` for the locked token
- **Controlled by sender** - Sender controls when to lock
- **Signed by issuer** - Rules contract requires issuer signature

### Unlock (Accept or Abort Phase)

```daml
choice Unlock : ContractId MyToken
  controller holders
```

Key behaviors:
- **Controlled by issuer** - holders = [issuer]
- **Restores state** - Returns unlocked MyToken
- **Atomic with transfer** - Part of executeTwoStepTransfer
- **Cannot be bypassed** - Only unlock path is via holders

## Disclosure Pattern for Cross-Party Visibility

**Problem:** Receiver is only an observer on MyTransferInstruction but needs to see LockedMyToken (where they're not a signatory or observer).

**Solution:** Disclosure mechanism

```daml
-- Issuer fetches the instruction
Some instr <- queryContractId @MyTransferInstruction issuer instrCid

-- Issuer gets disclosure for locked token
optDisc <- queryDisclosure @LockedMyToken issuer instr.lockedMyToken

-- Receiver submits with disclosure
submitWithDisclosures receiver [disclosure] do
  exerciseCmd instrCid TransferInstruction_Accept with ...
```

This pattern:
- Enables cross-party visibility without changing contract signatories
- Requires issuer cooperation (cannot be bypassed)
- Only works in off-ledger scripts (not on-ledger automation)
- Provides receiver with cryptographic proof of locked token existence

## Timeline and Deadlines

Every transfer has two critical timestamps:

```
Past <------- requestedAt ------- NOW ------- executeBefore -------> Future
              (must be past)                  (must be future)
```

- **requestedAt** - When the transfer was initiated (must be before current time)
- **executeBefore** - Deadline for completion (must be after current time)

If deadline expires:
- Accept will fail with assertion error
- Sender must create new transfer request
- Locked tokens remain locked until unlocked or expired

## Multi-Leg DvP Settlement

Transfer instructions can be coordinated for atomic Delivery versus Payment:

```
Leg 1: Alice sends 100 MyToken to Bob
Leg 2: Bob sends $100 USD to Alice

MySettlementCoordinator coordinates atomic execution:
- Both legs lock tokens via AllocationFactory
- Coordinator.ExecuteAll exercises both allocations
- All legs succeed or all fail atomically
- Requires: executor + all senders + all receivers signatures
```

Pattern:
1. Create AllocationRequests for each leg
2. Admin accepts requests (auto-locks via AllocationFactory)
3. Create MySettlementCoordinator
4. Add each allocation leg via AddLeg choice
5. Execute ExecuteAll choice (requires signatures from executor + all senders + all receivers)
6. All transfers complete atomically

Note: The multi-party authorization is enforced by the contract signatories and choice controllers. In tests, `submitMulti` is used as a convenience to provide all required signatures, but in production this would be handled by the workflow orchestration layer.

## Why This Pattern Exists

The transfer instruction pattern provides:

1. **Regulatory compliance** - Issuer maintains oversight of all transfers
2. **Risk management** - Receivers can reject suspicious transfers
3. **Atomic DvP** - Multi-leg settlements cannot partially execute
4. **State safety** - Locked tokens prevent double-spending during pending phase
5. **Explicit consent** - All parties explicitly authorize via signatures
6. **Audit trail** - Each step creates traceable on-ledger records

This is critical for:
- Security tokens requiring transfer restrictions
- Regulated financial instruments
- Cross-border settlements requiring compliance checks
- Any scenario where transfers need explicit three-party consent

## Current Implementation Files

- `MyToken.daml` - Core token with Lock/Unlock choices
- `MyTokenRules.daml` - Utility for atomic locking with splitting
- `MyTransferFactory.daml` - Implements TransferFactory interface
- `MyTokenTransferInstruction.daml` - Implements TransferInstruction interface
- `MyToken/TwoStepTransfer.daml` - Helper functions for prepare/execute/abort
- `MyToken/TransferRequest.daml` - Request/accept pattern for authorization
- `Test/RegistryApi.daml` - Disclosure helpers for cross-party visibility
- `Test/Scripts.daml` - Comprehensive test scenarios

## Key Takeaway

Transfer instructions implement a **cooperative three-party authorization model** where sender, receiver, and issuer must all participate for a transfer to complete. This provides the control and auditability required for regulated token transfers while maintaining atomic state transitions and preventing double-spending.
