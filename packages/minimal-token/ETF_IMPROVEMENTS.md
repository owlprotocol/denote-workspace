# ETF Implementation Improvement Roadmap

This document tracks potential improvements and fixes for the ETF (Exchange-Traded Fund) implementation based on critical analysis of the current design.

## 🔴 Critical Issues (Security & Correctness)

### Issue #1: No NAV (Net Asset Value) Tracking or Validation
**Priority:** High
**Status:** ❌ Not Started

**Problem:**
The implementation has no mechanism to ensure fair pricing. ETF tokens are minted/burned at a fixed 1:1 ratio with underlying assets based purely on portfolio weights, with no concept of market value or NAV.

**Impact:**
- If Token1 is worth $100 and Token2 is worth $1, but both have weight 1.0, an ETF token incorrectly treats them as equal
- No price discovery mechanism
- Enables immediate arbitrage opportunities

**Current Behavior:**
```daml
-- 1 ETF = 1.0 of each underlying (regardless of market value)
```

**Proposed Solution:**
- Add price oracle integration or manual NAV updates before mint/burn operations
- Store NAV per share in PortfolioComposition or separate pricing contract
- Validate mint/burn requests against current NAV

**Files to Modify:**
- `daml/ETF/PortfolioComposition.daml` - Add price/NAV fields
- `daml/ETF/MyMintRequest.daml` - Add NAV validation
- `daml/ETF/MyBurnRequest.daml` - Add NAV validation

---

### Issue #2: Race Condition - Transfer Instructions Can Be Accepted by Others
**Priority:** Critical
**Status:** ❌ Not Started

**Problem:**
In `MyMintRequest.MintRequest_Accept` (lines 46-50), the code accepts transfer instructions that are already created and pending. Nothing prevents the receiver from accepting these instructions directly before the ETF mint completes, breaking atomicity guarantees.

**Attack Scenario:**
```
1. Alice creates 3 transfer instructions (Alice → Issuer)
2. Alice creates ETF mint request with those CIDs
3. Issuer accepts transfer instruction #1 directly (gets underlying token)
4. Issuer tries to accept ETF mint request
5. ETF acceptance fails (transfer instruction #1 already consumed)
6. Issuer now has 1 underlying asset but hasn't minted ETF
```

**Impact:**
- Breaks atomicity guarantees
- Enables griefing attacks
- Can cause partial state (some assets transferred, no ETF minted)

**Proposed Solutions (choose one):**

**Option A: Lock Transfer Instructions When ETF Request Created** (Recommended)

This is the most practical solution that preserves existing authorization flow while preventing the race condition.

**Implementation Steps:**

1. **Add Lock State to MyTransferInstruction**
```daml
template MyTransferInstruction
  with
    -- ... existing fields
    lockedForEtf : Optional (ContractId MyMintRequest)
    -- ^ If Some, this transfer instruction is locked for ETF minting
  where
    signatory sender, receiver
    observer issuer

    choice TransferInstruction_Accept : AcceptResult
      controller receiver
      do
        -- CHANGED: Prevent direct acceptance if locked for ETF
        assertMsg "Transfer instruction is locked for ETF minting"
          (isNone lockedForEtf)
        -- ... rest of accept logic
```

2. **Add Locking Choices to MyTransferInstruction**
```daml
-- Lock this transfer instruction for ETF minting
choice TransferInstruction_LockForEtfMint : ContractId MyTransferInstruction
  with
    etfMintRequestCid : ContractId MyMintRequest
  controller sender, issuer  -- Both parties authorize lock
  do
    assertMsg "Already locked" (isNone lockedForEtf)
    create this with lockedForEtf = Some etfMintRequestCid

-- Accept locked transfer instruction (only callable within ETF minting)
choice TransferInstruction_AcceptLocked : AcceptResult
  with
    etfMintRequestCid : ContractId MyMintRequest
  controller issuer  -- Issuer accepts on behalf of ETF minting
  do
    assertMsg "Not locked for this ETF request"
      (lockedForEtf == Some etfMintRequestCid)
    -- ... execute transfer logic
    -- Return unlocked tokens to receiver

-- Unlock transfer instruction (if ETF mint is declined/withdrawn)
choice TransferInstruction_Unlock : ContractId MyTransferInstruction
  controller sender, issuer
  do
    assertMsg "Not locked" (isSome lockedForEtf)
    create this with lockedForEtf = None
```

3. **Update MyMintRequest Creation to Lock Instructions**
```daml
-- When Alice creates MyMintRequest, lock all transfer instructions first
createMintRequestWithLocks : ... -> Update (ContractId MyMintRequest)
createMintRequestWithLocks transferInstructionCids mintRecipeCid requester amount issuer = do
  -- Lock all transfer instructions for this mint request
  lockedInstructionCids <- forA transferInstructionCids $ \tiCid ->
    exercise tiCid TransferInstruction_LockForEtfMint with
      etfMintRequestCid = self  -- Will be the new mint request CID

  -- Create the mint request with locked instruction CIDs
  create MyMintRequest with
    mintRecipeCid
    requester
    amount
    transferInstructionCids = lockedInstructionCids
    issuer
```

4. **Update MintRequest_Accept to Accept Locked Instructions**
```daml
choice MintRequest_Accept : ContractId MyToken
  controller issuer
  do
    mintRecipe <- fetch mintRecipeCid
    portfolioComp <- fetch (mintRecipe.composition)

    -- Validate transfer instructions
    forA_ (zip transferInstructionCids portfolioComp.items) $
      \(tiCid, portfolioItem) -> do
        ti <- fetch tiCid
        -- Verify locked for THIS mint request
        assertMsg "Transfer instruction not locked for this request"
          (ti.lockedForEtf == Some self)
        validateTransferInstruction tiCid portfolioItem amount issuer requester

    -- Accept all locked transfer instructions
    forA_ transferInstructionCids $ \tiCid ->
      exercise tiCid TransferInstruction_AcceptLocked with
        etfMintRequestCid = self

    -- Mint ETF tokens
    exercise mintRecipeCid MyMintRecipe.MyMintRecipe_Mint with
      receiver = requester
      amount = amount
```

5. **Add Unlock on Decline/Withdraw**
```daml
choice MintRequest_Decline : ()
  controller issuer
  do
    -- Unlock all transfer instructions so Alice can use them elsewhere
    forA_ transferInstructionCids $ \tiCid ->
      exercise tiCid TransferInstruction_Unlock

choice MintRequest_Withdraw : ()
  controller requester
  do
    -- Unlock all transfer instructions
    forA_ transferInstructionCids $ \tiCid ->
      exercise tiCid TransferInstruction_Unlock
```

**Pros:**
✅ Clear state management (locked vs unlocked)
✅ Prevents race condition completely
✅ Preserves existing authorization flow (Alice creates transfers, issuer accepts)
✅ Minimal architectural changes
✅ Lock can be released if ETF mint is declined/withdrawn
✅ Explicit authorization from both parties to lock

**Cons:**
❌ Requires adding state to MyTransferInstruction template
❌ Need new choices: LockForEtfMint, AcceptLocked, Unlock
❌ Slightly more complex MyTransferInstruction contract

**Files to Modify:**
- `daml/MyTokenTransferInstruction.daml` - Add lockedForEtf field and locking choices
- `daml/ETF/MyMintRequest.daml` - Update creation flow to lock instructions, update Accept to use locked instructions
- `daml/ETF/MyBurnRequest.daml` - Same changes for burn flow
- `daml/ETF/Test/ETFTest.daml` - Update tests to lock instructions before creating requests
- `packages/token-sdk/src/wrappedSdk/transferInstruction.ts` - Add lock/unlock functions
- `packages/token-sdk/src/wrappedSdk/etf/mintRequest.ts` - Update to lock before creating request
- `packages/token-sdk/src/wrappedSdk/etf/burnRequest.ts` - Update to lock before creating request

---

**Option B: Use Disclosure-Based Access Control**
- Make transfer instructions not visible to receiver until after ETF minting completes
- Requires architectural changes to visibility model
- Not recommended due to complexity

---

### Issue #3: Issuer Can Bypass MyMintRecipe and Mint ETF Tokens Directly ✅
**Priority:** Critical
**Status:** ✅ **COMPLETED**

**Problem:**
The ETF factory is a regular `MyTokenFactory`, allowing the issuer to mint unbacked ETF tokens by calling `Mint` choice directly, completely bypassing the backing asset requirements.

**Current Code:**
```daml
-- Issuer can mint unbacked ETF tokens:
exercise etfFactoryCid MyTokenFactory.Mint with
  receiver = issuer
  amount = 1000000.0  -- No underlying assets transferred!
```

**Impact:**
- Defeats the entire purpose of requiring backing assets
- Allows issuer to inflate ETF supply without custody of underlying assets
- Breaks trust model

**Proposed Solutions (choose one):**

**Option A: Create Dedicated ETFTokenFactory** (Recommended)
- Create new `ETFTokenFactory` template that only allows minting via `MyMintRecipe`
- Remove direct `Mint` choice or restrict controller to recipe contract
```daml
template ETFTokenFactory
  with
    issuer : Party
    instrumentId : Text
  where
    signatory issuer

    -- Only callable by MyMintRecipe, not directly
    nonconsuming choice RecipeMint : ContractId MyToken
      with
        recipe : ContractId MyMintRecipe
        receiver : Party
        amount : Decimal
      controller issuer
      do
        -- Verify recipe owns this factory
        recipeData <- fetch recipe
        assertMsg "Factory mismatch" (recipeData.tokenFactory == self)
        create MyToken with ...
```

**Option B: Embed Factory Logic in MyMintRecipe**
- Remove `tokenFactory` field from `MyMintRecipe`
- Create tokens directly in `MyMintRecipe_Mint` choice
- No separate factory contract needed

**Fix Applied:**
Implemented **Option B: Embed Factory Logic in MyMintRecipe** (simpler and more secure):

1. **Removed `tokenFactory` field** from `MyMintRecipe` template (daml/ETF/MyMintRecipe.daml:11-14)
2. **MyMintRecipe_Mint choice now creates MyToken directly** (daml/ETF/MyMintRecipe.daml:32-36):
   ```daml
   create MyToken with
     issuer = issuer
     owner = receiver
     instrumentId = instrumentId
     amount = amount
   ```
3. **Updated TypeScript SDK** (`packages/token-sdk/src/wrappedSdk/etf/mintRecipe.ts:11-16`) - Removed tokenFactory from `MintRecipeParams`
4. **Updated test scripts** (etfMint.ts, etfBurn.ts) - No longer pass tokenFactory when creating mint recipe

**Result:** Issuer can no longer bypass MyMintRecipe to mint unbacked ETF tokens. All ETF minting must go through MyMintRequest validation flow, ensuring proper backing.

---

## 🟠 Major Issues (Functionality & Robustness)

### Issue #4: No Partial Mint/Burn Support
**Priority:** Medium
**Status:** ❌ Not Started

**Problem:**
Must mint/burn exact portfolio weights. If you own 2.5 units of Token1 but portfolio requires 1.0, you can't mint 2.5 ETF tokens without splitting tokens first.

**Impact:**
- Poor capital efficiency
- Users forced to acquire exact fractional amounts
- Extra transactions needed for splitting

**Proposed Solution:**
- Implement splitting logic similar to `MyTokenRules` lock/split pattern
- Add `splitIfNeeded` logic in validation phase
- Return change tokens to requester

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Add splitting logic
- `daml/ETF/MyBurnRequest.daml` - Add splitting logic

---

### Issue #5: Static Portfolio Composition with Breaking Changes
**Priority:** High
**Status:** ❌ Not Started

**Problem:**
`MyMintRecipe_UpdateComposition` allows changing the portfolio, but existing ETF tokens don't track which composition version they were minted with. Burning becomes ambiguous.

**Scenario:**
```
1. Mint 100 ETF tokens with composition v1 (Token A, B, C with weights 1.0, 1.0, 1.0)
2. Update composition to v2 (Token D, E, F with weights 2.0, 2.0, 2.0)
3. User tries to burn 50 ETF tokens:
   - Which composition applies?
   - Should they receive A/B/C or D/E/F?
   - What quantities?
```

**Impact:**
- Burning becomes ambiguous and potentially unfair
- Users can't verify their backing
- No audit trail of composition changes
- Potential disputes between issuer and token holders

**Proposed Solutions (choose one):**

**Option A: Version ETF Tokens with Composition Snapshot** (Recommended)
```daml
template MyToken
  with
    issuer : Party
    owner : Party
    instrumentId : Text
    amount : Decimal
    compositionSnapshot : [PortfolioItem]  -- NEW: Snapshot at mint time
    compositionVersion : Int              -- NEW: Version tracking
```
- Each ETF token stores its composition at mint time
- Burning uses the snapshot, not current recipe composition
- Clear, unambiguous redemption rights

**Option B: Separate Mint Recipes Per Composition Version**
- Create new `MyMintRecipe` contract for each composition change
- Archive old recipe (can't mint with old composition anymore)
- ETF tokens reference specific recipe CID
- Burning fetches referenced recipe's composition

**Option C: Disallow Composition Changes After Any Minting**
- Add check in `MyMintRecipe_UpdateComposition`:
```daml
choice MyMintRecipe_UpdateComposition : ContractId MyMintRecipe
  controller issuer
  do
    -- Query for any tokens minted with this recipe
    tokens <- query @MyToken
    assertMsg "Cannot update composition after minting" (null tokens)
    create this with composition = newComposition
```
- Simplest solution but least flexible
- Requires creating new instrument for composition changes

**Files to Modify:**
- `daml/MyToken.daml` - Add composition fields (Option A)
- `daml/ETF/MyMintRecipe.daml` - Add versioning or restrictions
- `daml/ETF/MyBurnRequest.daml` - Use composition snapshot for burning
- `daml/ETF/Test/ETFTest.daml` - Add composition update tests

---

### Issue #6: No Decimal Precision Validation
**Priority:** Medium
**Status:** ❌ Not Started

**Problem:**
Weight multiplication can cause rounding errors with no precision limits. Exact equality check fails for valid operations with fractional weights.

**Current Code:**
```daml
-- ETF/MyMintRequest.daml:79
assertMsg "Transfer instruction amount does not match expected amount"
  (tiView.transfer.amount == (portfolioItem.weight * amount))
```

**Impact:**
- `weight = 0.333333...` × `amount = 1.0` = rounding errors
- Validation failures for valid operations
- Decimal precision issues in Daml (28-29 decimal places)

**Example Failure:**
```daml
-- Portfolio: Token A with weight 0.333333
-- Mint: 1.0 ETF
-- Required: 0.333333 of Token A
-- User provides: 0.333333 (but represented as 0.33333300000...)
-- Validation: FAILS due to trailing precision differences
```

**Proposed Solution:**
Use threshold-based comparison instead of exact equality:
```daml
validateTransferInstruction tiCid portfolioItem amount issuer requester = do
  ti <- fetch tiCid
  let tiView = view ti
  let expectedAmount = portfolioItem.weight * amount
  let tolerance = 0.0000001  -- 7 decimal places tolerance

  assertMsg "Transfer instruction sender does not match requester"
    (tiView.transfer.sender == requester)
  assertMsg "Transfer instruction receiver does not match issuer"
    (tiView.transfer.receiver == issuer)
  assertMsg ("Transfer instruction instrumentId does not match portfolio item")
    (tiView.transfer.instrumentId == portfolioItem.instrumentId)
  assertMsg "Transfer instruction amount does not match expected amount"
    (abs (tiView.transfer.amount - expectedAmount) < tolerance)
```

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Update `validateTransferInstruction`
- `daml/ETF/MyBurnRequest.daml` - Update `validateTransferInstruction`
- Add tests with fractional weights (0.333, 0.142857, etc.)

---

### Issue #7: Array Ordering Dependency is Fragile
**Priority:** Medium
**Status:** ❌ Not Started

**Problem:**
Both mint and burn require `transferInstructionCids` in exact same order as `portfolioComp.items` (via `zip` function). Easy to get wrong, fails with confusing error message.

**Current Code:**
```daml
-- ETF/MyMintRequest.daml:42-43
forA_ (zip transferInstructionCids portfolioComp.items) $
  \(tiCid, portfolioItem) -> validateTransferInstruction tiCid portfolioItem amount issuer requester
```

**Impact:**
- Easy to get wrong in SDK/client code
- No clear error message indicates ordering issue
- Fails with misleading "instrumentId does not match" error
- Documented as "critical pattern" in SDK due to fragility

**Example Error:**
```
User provides: [Token B CID, Token A CID, Token C CID]
Portfolio expects: [Token A, Token B, Token C]
Error: "Transfer instruction instrumentId does not match portfolio item: B, A"
^ Confusing - user might think B is wrong, not that ordering is wrong
```

**Proposed Solution:**
Use a map/dictionary structure keyed by instrumentId:
```daml
template MyMintRequest
  with
    -- OLD: transferInstructionCids: [ContractId TI.TransferInstruction]
    -- NEW:
    transferInstructions : [(InstrumentId, ContractId TI.TransferInstruction)]
  where
    -- ...

choice MintRequest_Accept : ContractId MyToken
  controller issuer
  do
    mintRecipe <- fetch mintRecipeCid
    portfolioComp <- fetch (mintRecipe.composition)

    -- Validate all portfolio items have matching transfer instructions
    forA_ portfolioComp.items $ \portfolioItem -> do
      case lookup portfolioItem.instrumentId transferInstructions of
        None -> abort ("Missing transfer instruction for " <> show portfolioItem.instrumentId)
        Some tiCid -> validateTransferInstruction tiCid portfolioItem amount issuer requester

    -- Accept all transfer instructions
    forA_ transferInstructions $ \(_, tiCid) ->
      exercise tiCid TI.TransferInstruction_Accept with ...
```

**Alternative (Less Disruptive):**
Keep array structure but add better validation error messages:
```daml
-- Validate that all instrumentIds are present before checking order
let tiInstrumentIds = ... -- extract from transfer instructions
let portfolioInstrumentIds = map (.instrumentId) portfolioComp.items
assertMsg "Missing transfer instructions"
  (all (`elem` tiInstrumentIds) portfolioInstrumentIds)
assertMsg ("Transfer instructions in wrong order. Expected: " <> show portfolioInstrumentIds <> ", Got: " <> show tiInstrumentIds)
  (tiInstrumentIds == portfolioInstrumentIds)
```

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Change data structure or validation
- `daml/ETF/MyBurnRequest.daml` - Change data structure or validation
- `packages/token-sdk/src/wrappedSdk/etf/mintRequest.ts` - Update TypeScript interface
- `packages/token-sdk/src/wrappedSdk/etf/burnRequest.ts` - Update TypeScript interface
- `packages/token-sdk/src/testScripts/etfMint.ts` - Update test script
- `packages/token-sdk/src/testScripts/etfBurn.ts` - Update test script

---

## 🟡 Design Concerns (User Experience & Maintenance)

### Issue #8: No Authorization Check on MyMintRecipe_Mint ✅
**Priority:** Medium
**Status:** ✅ **COMPLETED**

**Fix Applied:**
Line 38 in `daml/ETF/MyMintRequest.daml` now includes:
```daml
assertMsg "Mint recipe requester must be an authorized minter"
  (requester `elem` mintRecipe.authorizedMinters)
```

Authorization is properly enforced in the `MintRequest_Accept` choice.

---

### Issue #9: No Slippage Protection or Deadline
**Priority:** Medium
**Status:** ❌ Not Started

**Problem:**
Mint/burn requests have no expiration time. Markets can move significantly between request creation and acceptance, leading to unfair pricing.

**Scenario:**
```
1. Alice creates mint request when ETF NAV is $100
2. Market moves significantly
3. ETF NAV drops to $80 (20% decline)
4. Issuer accepts request
5. Alice gets ETF at stale $100 price, immediate 20% profit
```
Or vice versa for burns (issuer profits, user loses).

**Impact:**
- No protection against market movement
- Unfair pricing for one party
- Issuer or user can game timing of acceptance

**Proposed Solution:**
Add deadline field like transfer instructions:
```daml
template MyMintRequest
  with
    mintRecipeCid: ContractId MyMintRecipe
    requester: Party
    amount: Decimal
    transferInstructionCids: [ContractId TI.TransferInstruction]
    issuer: Party
    requestedAt: Time       -- NEW: Request creation time
    executeBefore: Time     -- NEW: Expiration deadline
  where
    signatory requester
    observer issuer

    ensure amount > 0.0
    ensure requestedAt < executeBefore  -- Deadline must be in future

choice MintRequest_Accept : ContractId MyToken
  controller issuer
  do
    now <- getTime
    assertMsg "Request created in future" (requestedAt <= now)
    assertMsg "Request expired" (now < executeBefore)
    -- ... rest of validation
```

**Additional Consideration:**
- Consider adding max slippage tolerance (e.g., NAV can't move more than 1% from request time)
- Requires NAV tracking (see Issue #1)

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Add time fields and validation
- `daml/ETF/MyBurnRequest.daml` - Add time fields and validation
- `daml/ETF/Test/ETFTest.daml` - Update tests with timestamps
- `packages/token-sdk/src/wrappedSdk/etf/mintRequest.ts` - Update TypeScript interface
- `packages/token-sdk/src/wrappedSdk/etf/burnRequest.ts` - Update TypeScript interface

---

### Issue #10: Missing Events/Observability
**Priority:** Low
**Status:** ❌ Not Started

**Problem:**
No events emitted for ETF minting/burning, making it hard to track total supply, monitor backing asset custody, or audit mint/burn history.

**Impact:**
- Can't easily calculate total ETF supply
- No audit trail for compliance
- Difficult to track backing asset custody
- Can't monitor NAV changes over time
- No off-ledger indexing/analytics

**Proposed Solution:**
Add interface events or separate audit contracts:

**Option A: Daml Interface Events** (Recommended)
```daml
-- ETF/MyMintRequest.daml
choice MintRequest_Accept : ContractId MyToken
  controller issuer
  do
    -- ... validation and minting logic

    emitEvent ETFMintEvent with
      etfInstrumentId = mintRecipe.instrumentId
      requester
      amount
      underlyingAssets = map (\item -> (item.instrumentId, item.weight * amount)) portfolioComp.items
      timestamp = now
      etfTokenCid = result
```

**Option B: Audit Contract Log**
```daml
template ETFAuditLog
  with
    issuer : Party
    entries : [AuditEntry]
  where
    signatory issuer

data AuditEntry = AuditEntry
  with
    timestamp : Time
    operation : Text  -- "MINT" or "BURN"
    requester : Party
    amount : Decimal
    etfTokenCid : ContractId MyToken
```

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Add event emission
- `daml/ETF/MyBurnRequest.daml` - Add event emission
- `daml/ETF/ETFEvents.daml` - New file for event definitions (Option A)
- `daml/ETF/ETFAuditLog.daml` - New file for audit log (Option B)

---

### Issue #11: No Fees or Incentive Mechanism
**Priority:** Low
**Status:** ❌ Not Started

**Problem:**
Issuer has no economic incentive to operate the ETF. No management fees, creation fees, or redemption fees.

**Real-World Comparison:**
Real ETFs charge:
- Management fees: 0.03% - 1% annually (deducted from NAV)
- Creation/redemption fees: 0.01% - 0.05% per transaction for authorized participants

**Impact:**
- No sustainable business model for ETF issuer
- Issuer must subsidize operational costs
- May discourage professional ETF management

**Proposed Solution:**

**Option A: Mint/Burn Fees** (Simple)
```daml
template MyMintRequest
  with
    -- ... existing fields
    fee : Decimal  -- Fee in ETF tokens (e.g., 0.001 = 0.1%)
  where
    -- ...

choice MintRequest_Accept : MintResult
  controller issuer
  do
    -- ... validation

    let netAmount = amount * (1.0 - fee)
    let feeAmount = amount * fee

    -- Mint ETF to requester (minus fee)
    requesterToken <- exercise mintRecipeCid MyMintRecipe.MyMintRecipe_Mint with
      receiver = requester
      amount = netAmount

    -- Mint fee portion to issuer
    feeToken <- exercise mintRecipeCid MyMintRecipe.MyMintRecipe_Mint with
      receiver = issuer
      amount = feeAmount

    return MintResult with
      etfTokenCid = requesterToken
      feeCid = feeToken
```

**Option B: Management Fee via Separate Lifecycle Rule** (Advanced)
- Similar to bond coupon payments, but in reverse
- Periodically dilute all ETF token holders by X% annually
- Issue diluted tokens to issuer as management fee
- Requires ETF token lifecycle management

**Files to Modify:**
- `daml/ETF/MyMintRequest.daml` - Add fee calculation
- `daml/ETF/MyBurnRequest.daml` - Add fee calculation
- `daml/ETF/MyMintRecipe.daml` - Add fee configuration
- `daml/ETF/Test/ETFTest.daml` - Add fee tests

---

### Issue #12: Burn Requires Pre-Created Transfer Instructions (Awkward UX)
**Priority:** Medium
**Status:** ❌ Not Started

**Problem:**
The burn flow requires issuer to create transfer instructions *before* accepting burn request. This is awkward and error-prone:

**Current Flow:**
```
1. Alice creates burn request
2. Issuer queries Alice's burn request
3. Issuer creates 3 transfer requests (one per underlying asset)
4. Issuer accepts 3 transfer requests → gets 3 transfer instruction CIDs
5. Issuer accepts burn request WITH those 3 CIDs as parameter
```

**Issues with Current Flow:**
- Issuer must manually create transfer instructions
- Easy to make mistakes (wrong amounts, wrong order)
- Multiple transactions required
- Not atomic (issuer could create transfers but not accept burn)
- Transfer instructions could be accepted by Alice before burn completes (same race condition as Issue #2)

**Proposed Solution:**
Create transfer instructions atomically inside `BurnRequest_Accept` choice:

```daml
template MyBurnRequest
  with
    mintRecipeCid: ContractId MyMintRecipe
    requester: Party
    amount: Decimal
    tokenFactoryCid: ContractId MyTokenFactory
    inputHoldingCid: ContractId MyToken
    issuer: Party
    -- REMOVED: No need for pre-created transfer instructions
    -- NEW: Add transfer factory references
    underlyingTransferFactories: [(InstrumentId, ContractId MyTransferFactory)]
  where
    signatory requester
    observer issuer

choice BurnRequest_Accept : BurnResult
  controller issuer
  do
    mintRecipe <- fetch mintRecipeCid
    portfolioComp <- fetch (mintRecipe.composition)

    -- Create transfer instructions atomically for each underlying asset
    transferInstructionCids <- forA portfolioComp.items $ \item -> do
      -- Find corresponding transfer factory
      let maybeFactory = lookup item.instrumentId underlyingTransferFactories
      factory <- case maybeFactory of
        None -> abort ("Missing transfer factory for " <> show item.instrumentId)
        Some f -> pure f

      -- Create transfer request
      now <- getTime
      let transfer = Transfer with
            sender = issuer
            receiver = requester
            amount = item.weight * amount
            instrumentId = item.instrumentId
            requestedAt = addRelTime now (seconds (-1))
            executeBefore = addRelTime now (hours 1)
            inputHoldingCids = []  -- Query issuer's holdings

      -- Create and immediately accept transfer instruction
      transferRequestCid <- create TransferRequest with
        transferFactoryCid = factory
        expectedAdmin = issuer
        transfer
        extraArgs = MD.emptyExtraArgs

      acceptResult <- exercise transferRequestCid TransferRequest.Accept
      pure acceptResult.output.transferInstructionCid

    -- Now accept all transfer instructions (transfer underlying assets back to requester)
    forA_ transferInstructionCids $ \tiCid ->
      exercise tiCid TI.TransferInstruction_Accept with
        extraArgs = MD.ExtraArgs with
          context = MD.emptyChoiceContext
          meta = MD.emptyMetadata

    -- Finally, burn the ETF token
    exercise tokenFactoryCid MyTokenFactory.Burn with
      owner = requester
      amount = amount
      inputHoldingCid = inputHoldingCid
```

**Benefits:**
- ✅ Single atomic transaction
- ✅ No race conditions (transfers created and accepted in same transaction)
- ✅ Simpler UX (issuer just accepts burn request, no manual transfer creation)
- ✅ Less error-prone (no manual CID collection)
- ✅ Consistent with how MyMintRequest should work (see Issue #2)

**Files to Modify:**
- `daml/ETF/MyBurnRequest.daml` - Remove `transferInstructionCids` parameter, add atomic creation logic
- `daml/ETF/Test/ETFTest.daml` - Simplify burn test (remove manual transfer instruction creation)
- `packages/token-sdk/src/wrappedSdk/etf/burnRequest.ts` - Update TypeScript interface (remove `transferInstructionCids` parameter from accept function)
- `packages/token-sdk/src/testScripts/etfBurn.ts` - Simplify test script

**Note:** This is the **recommended pattern** and should be implemented alongside Issue #2 for consistency.

---

## 🟢 Minor Issues (Code Quality & Completeness)

### Issue #13: Duplicate Code Between Mint and Burn Validation
**Priority:** Low
**Status:** ❌ Not Started

**Problem:**
`validateTransferInstruction` function is duplicated in both `MyMintRequest.daml` and `MyBurnRequest.daml` with only sender/receiver swapped.

**Current Code:**

`ETF/MyMintRequest.daml` (lines 67-78):
```daml
validateTransferInstruction tiCid portfolioItem amount issuer requester = do
  ti <- fetch tiCid
  let tiView = view ti
  assertMsg "Transfer instruction sender does not match requester" (tiView.transfer.sender == requester)
  assertMsg "Transfer instruction receiver does not match issuer" (tiView.transfer.receiver == issuer)
  assertMsg "..." (tiView.transfer.instrumentId == portfolioItem.instrumentId)
  assertMsg "..." (tiView.transfer.amount == (portfolioItem.weight * amount))
```

`ETF/MyBurnRequest.daml` (lines 72-83):
```daml
validateTransferInstruction tiCid portfolioItem amount issuer requester = do
  ti <- fetch tiCid
  let tiView = view ti
  assertMsg "Transfer instruction sender does not match issuer" (tiView.transfer.sender == issuer)  -- ONLY DIFFERENCE
  assertMsg "Transfer instruction receiver does not match requester" (tiView.transfer.receiver == requester)  -- ONLY DIFFERENCE
  assertMsg "..." (tiView.transfer.instrumentId == portfolioItem.instrumentId)
  assertMsg "..." (tiView.transfer.amount == (portfolioItem.weight * amount))
```

**Impact:**
- Code duplication
- Maintenance burden (bug fixes need to be applied twice)
- Risk of inconsistency between mint and burn validation

**Proposed Solution:**
Extract to shared module with direction parameter:
```daml
-- ETF/Validation.daml (new file)
module ETF.Validation where

import Splice.Api.Token.TransferInstructionV1 as TI
import ETF.PortfolioComposition (PortfolioItem)

data TransferDirection = MintDirection | BurnDirection

validateTransferInstruction
  : TransferDirection
  -> ContractId TI.TransferInstruction
  -> PortfolioItem
  -> Decimal
  -> Party
  -> Party
  -> Update ()
validateTransferInstruction direction tiCid portfolioItem amount issuer requester = do
  ti <- fetch tiCid
  let tiView = view ti

  case direction of
    MintDirection -> do
      assertMsg "Transfer instruction sender does not match requester"
        (tiView.transfer.sender == requester)
      assertMsg "Transfer instruction receiver does not match issuer"
        (tiView.transfer.receiver == issuer)
    BurnDirection -> do
      assertMsg "Transfer instruction sender does not match issuer"
        (tiView.transfer.sender == issuer)
      assertMsg "Transfer instruction receiver does not match requester"
        (tiView.transfer.receiver == requester)

  assertMsg ("Transfer instruction instrumentId does not match portfolio item: "
             <> show tiView.transfer.instrumentId <> ", " <> show portfolioItem.instrumentId)
    (tiView.transfer.instrumentId == portfolioItem.instrumentId)
  assertMsg "Transfer instruction amount does not match expected amount"
    (tiView.transfer.amount == (portfolioItem.weight * amount))
```

Then use in both contracts:
```daml
-- ETF/MyMintRequest.daml
import ETF.Validation (validateTransferInstruction, TransferDirection(..))

forA_ (zip transferInstructionCids portfolioComp.items) $
  \(tiCid, portfolioItem) ->
    validateTransferInstruction MintDirection tiCid portfolioItem amount issuer requester
```

**Files to Modify:**
- `daml/ETF/Validation.daml` - New shared module
- `daml/ETF/MyMintRequest.daml` - Remove duplicate function, import shared version
- `daml/ETF/MyBurnRequest.daml` - Remove duplicate function, import shared version

---

### Issue #14: No Metadata Support
**Priority:** Low
**Status:** ❌ Not Started

**Problem:**
Portfolio items and compositions have no metadata fields for additional information like:
- Asset descriptions
- Asset class categorization
- Issuer reputation scores
- Risk ratings
- Regulatory classifications
- External reference IDs

**Current Data Structure:**
```daml
data PortfolioItem = PortfolioItem
  with
    instrumentId: InstrumentId
    weight: Decimal
  deriving (Eq, Show)
```

**Impact:**
- Limited information for users making mint/burn decisions
- No way to store asset categorization
- Difficult to implement compliance or risk management features
- Can't track external references (e.g., ISIN, CUSIP)

**Proposed Solution:**
Add optional metadata fields:
```daml
data PortfolioItem = PortfolioItem
  with
    instrumentId: InstrumentId
    weight: Decimal
    metadata: Optional PortfolioItemMetadata
  deriving (Eq, Show)

data PortfolioItemMetadata = PortfolioItemMetadata
  with
    description: Text
    assetClass: Optional Text  -- "equity", "fixed-income", "commodity", etc.
    issuerName: Optional Text
    externalReferenceId: Optional Text  -- ISIN, CUSIP, etc.
    additionalInfo: [(Text, Text)]  -- Key-value pairs for extensibility
  deriving (Eq, Show)

template PortfolioComposition
  with
    owner : Party
    name : Text
    items : [PortfolioItem]
    description: Optional Text  -- NEW: Overall portfolio description
    category: Optional Text     -- NEW: "equity", "balanced", "fixed-income", etc.
  where
    signatory owner
```

**Files to Modify:**
- `daml/ETF/PortfolioComposition.daml` - Add metadata fields
- `daml/ETF/Test/ETFTest.daml` - Update tests (metadata can be None for existing tests)
- `packages/token-sdk/src/wrappedSdk/etf/portfolioComposition.ts` - Update TypeScript interfaces

---

### Issue #15: Test Coverage Gaps
**Priority:** Low
**Status:** ❌ Not Started

**Problem:**
Current test suite (`daml/ETF/Test/ETFTest.daml`) has limited coverage. Missing critical test cases for edge cases and error conditions.

**Current Tests:**
- ✅ `mintToSelfTokenETF` - Basic mint with issuer as minter
- ✅ `mintToOtherTokenETF` - Mint with authorized third party
- ✅ `burnTokenETF` - Basic burn flow

**Missing Test Cases:**

#### 15.1: Weight-Based Amount Calculations with Fractional Weights
```daml
testFractionalWeights : Script ()
testFractionalWeights = script do
  -- Portfolio with fractional weights (0.333, 0.5, 1.5)
  -- Mint 1.0 ETF
  -- Verify required amounts: 0.333, 0.5, 1.5
  -- Test decimal precision handling
```

#### 15.2: Composition Update Mid-Lifecycle
```daml
testCompositionUpdate : Script ()
testCompositionUpdate = script do
  -- Mint ETF with composition v1
  -- Update composition to v2
  -- Attempt to burn ETF (should use which composition?)
  -- Expected behavior depends on Issue #5 resolution
```

#### 15.3: Multiple Concurrent Mint Requests
```daml
testConcurrentMints : Script ()
testConcurrentMints = script do
  -- Alice creates mint request #1
  -- Bob creates mint request #2 (uses same underlying transfer instructions?)
  -- Issuer accepts both
  -- Verify both succeed or proper failure handling
```

#### 15.4: Partial Burns (When Issue #4 Implemented)
```daml
testPartialBurn : Script ()
testPartialBurn = script do
  -- Alice owns 5.0 ETF tokens
  -- Burn 2.0 ETF tokens
  -- Verify: 2.0 burned, 3.0 remaining
  -- Verify correct proportion of underlying assets returned
```

#### 15.5: Error Cases - Wrong InstrumentId Order
```daml
testWrongInstrumentIdOrder : Script ()
testWrongInstrumentIdOrder = script do
  -- Portfolio expects: [Token A, Token B, Token C]
  -- Provide transfers: [Token B, Token A, Token C]  -- Wrong order
  -- Expected: Validation fails with clear error message
  submitMustFail issuer $ exerciseCmd mintRequestCid MintRequest_Accept
```

#### 15.6: Error Cases - Insufficient Amounts
```daml
testInsufficientAmounts : Script ()
testInsufficientAmounts = script do
  -- Portfolio requires: [1.0 Token A, 1.0 Token B, 1.0 Token C]
  -- Provide transfers: [0.5 Token A, 1.0 Token B, 1.0 Token C]  -- Insufficient Token A
  -- Expected: Validation fails
  submitMustFail issuer $ exerciseCmd mintRequestCid MintRequest_Accept
```

#### 15.7: Error Cases - Unauthorized Minter
```daml
testUnauthorizedMinter : Script ()
testUnauthorizedMinter = script do
  -- Bob is NOT in authorizedMinters list
  -- Bob creates mint request
  -- Expected: Validation fails in MintRequest_Accept
  submitMustFail issuer $ exerciseCmd bobMintRequestCid MintRequest_Accept
```

#### 15.8: Error Cases - Duplicate Transfer Instructions
```daml
testDuplicateTransferInstructions : Script ()
testDuplicateTransferInstructions = script do
  -- Provide same transfer instruction CID multiple times
  -- transferInstructionCids = [ti1, ti1, ti1]  -- Duplicate ti1
  -- Expected: Validation fails or proper error handling
```

#### 15.9: Mint Request Decline and Withdraw
```daml
testMintRequestDecline : Script ()
testMintRequestDecline = script do
  -- Alice creates mint request
  -- Issuer declines
  -- Verify: Request archived, transfer instructions still pending
  -- Alice can still accept or withdraw transfer instructions

testMintRequestWithdraw : Script ()
testMintRequestWithdraw = script do
  -- Alice creates mint request
  -- Alice withdraws before issuer accepts
  -- Verify: Request archived, transfer instructions still pending
```

#### 15.10: Burn Request Decline and Withdraw
```daml
testBurnRequestDecline : Script ()
testBurnRequestDecline = script do
  -- Alice creates burn request with ETF token
  -- Issuer declines
  -- Verify: Request archived, ETF token still owned by Alice

testBurnRequestWithdraw : Script ()
testBurnRequestWithdraw = script do
  -- Alice creates burn request
  -- Alice withdraws before issuer accepts
  -- Verify: Request archived, ETF token still owned by Alice
```

#### 15.11: Composition Management
```daml
testAddAuthorizedMinter : Script ()
testAddAuthorizedMinter = script do
  -- Initial: authorizedMinters = [issuer]
  -- Add Bob
  -- Verify: Bob can now create mint requests

testRemoveAuthorizedMinter : Script ()
testRemoveAuthorizedMinter = script do
  -- Initial: authorizedMinters = [issuer, alice]
  -- Remove Alice
  -- Verify: Alice can no longer create mint requests (fails authorization check)

testUpdatePortfolioComposition : Script ()
testUpdatePortfolioComposition = script do
  -- Create composition v1
  -- Create mint recipe with v1
  -- Update to composition v2
  -- Verify: Mint recipe now uses v2
  -- Edge case: What happens to tokens minted with v1?
```

**Implementation Plan:**
1. Create comprehensive test suite in `daml/ETF/Test/ETFTestSuite.daml`
2. Run tests with `daml test --all`
3. Fix any discovered bugs
4. Add tests to CI/CD pipeline

**Files to Modify:**
- `daml/ETF/Test/ETFTestSuite.daml` - New comprehensive test file
- `daml.yaml` - Add test suite to test configuration

---

## Implementation Priority Recommendations

### Phase 1: Critical Security Fixes (Do First)
1. ✅ **Issue #8**: Authorization check in MintRequest_Accept (COMPLETED)
2. ✅ **Issue #3**: Block direct ETF factory minting (COMPLETED - prevents unbacked tokens)
3. **Issue #2**: Fix race condition on transfer instructions (ensures atomicity)

### Phase 2: Core Functionality (Do Before Production)
4. **Issue #5**: Add composition versioning (prevents burning ambiguity)
5. **Issue #12**: Improve burn UX with atomic transfer creation (consistency with mint)
6. **Issue #6**: Fix decimal precision validation (prevents false failures)

### Phase 3: Enhanced Features (Do For Production Readiness)
7. **Issue #1**: Add NAV tracking and validation (fair pricing)
8. **Issue #9**: Add slippage protection and deadlines (user protection)
9. **Issue #7**: Fix array ordering dependency (better UX, fewer errors)
10. **Issue #15**: Expand test coverage (quality assurance)

### Phase 4: Nice-to-Have (Future Enhancements)
11. **Issue #4**: Add partial mint/burn support (capital efficiency)
12. **Issue #10**: Add events/observability (monitoring and compliance)
13. **Issue #11**: Add fees and incentives (business model)
14. **Issue #13**: Refactor duplicate validation code (code quality)
15. **Issue #14**: Add metadata support (rich information)

---

## Notes

- This document captures the current state of the ETF implementation as of analysis date
- Some issues may have dependencies (e.g., Issue #12 depends on Issue #2 resolution)
- Priority rankings are based on security impact, user experience, and production readiness
- Test coverage (Issue #15) should be expanded as other issues are fixed

## References

- Main implementation: `daml/ETF/`
- Test suite: `daml/ETF/Test/ETFTest.daml`
- TypeScript SDK: `packages/token-sdk/src/wrappedSdk/etf/`
- Related documentation: `CLAUDE.md`, `README.md`
