# Splice Wallet Kernel - Interface Choice Execution

This document captures key learnings from the [splice-wallet-kernel](https://github.com/hyperledger-labs/splice-wallet-kernel) repository about exercising Daml interface choices through the Canton Ledger HTTP API.

## Key Finding: Interface Choices Can Be Exercised Directly

The Canton Ledger API **supports exercising interface choices directly** without requiring explicit choices on concrete templates. This is demonstrated in `core/ledger-client/src/token-standard-service.ts`.

## How It Works

### Template ID Formats

Canton uses two different template ID formats depending on the context:

#### 1. Package-Name Format (for queries and commands)

Used for:
- Querying contracts via `activeContracts({ templateIds: [...] })`
- Exercise commands (`ExerciseCommand.templateId`)
- Create commands (`CreateCommand.templateId`)

```typescript
// Interface ID (for interface choices)
"#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction"

// Concrete template ID
"#minimal-token:MyTokenTransferInstruction:MyTransferInstruction"
```

Format: `#package-name:Module.Path:TemplateName`

#### 2. Package-ID Reference Format (from ledger responses)

Used for:
- Disclosed contracts (`DisclosedContract.templateId`)
- Returned from ledger in `createdEvent.templateId`

```typescript
// Example from createdEvent.templateId
"0d72f4c13c12b2e85e10496e4bce230d8f847eb96782f1d36412a798ab04c17d:MyTokenTransferInstruction:MyTransferInstruction"
```

Format: `{64-char-hex-package-id}:Module.Path:TemplateName` (no `#` prefix)

**Important**: When creating `DisclosedContract` objects, always use the `templateId` from `createdEvent.templateId` which is already in package-id reference format. This is the correct format expected by the ledger API for disclosed contracts.

### Exercise Command Structure

From `createAcceptTransferInstructionFromContext` (lines 796-823):

```typescript
const exercise: ExerciseCommand = {
    templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,  // Interface, not concrete!
    contractId: transferInstructionCid,              // Actual contract ID
    choice: 'TransferInstruction_Accept',            // Interface choice name
    choiceArgument: {
        extraArgs: {
            context: choiceContext.choiceContextData,
            meta: { values: {} },
        },
    },
}
```

### Key Differences from Daml Script

| Aspect | Daml Script | Canton HTTP API |
|--------|-------------|-----------------|
| Template ID prefix | `#package-name:...` | `#package-name:...` (same) |
| Interface resolution | Automatic | Requires interface package on ledger |
| Choice name | Qualified or unqualified | Use interface choice name |
| Disclosed contracts | Via `submitWithDisclosures` | Via `disclosedContracts` array |

## Prerequisites

Before exercising interface choices:

1. **Upload interface package DARs** to the ledger
2. **Upload concrete implementation DARs** that implement the interface
3. **Get disclosed contracts** for any contracts the receiver needs to see

### Example: Splice API Token Transfer

```typescript
// 1. Upload Splice API DARs
await ledger.uploadDarFile(spliceApiTransferInstructionDar);
await ledger.uploadDarFile(spliceApiHoldingDar);
await ledger.uploadDarFile(spliceApiMetadataDar);

// 2. Upload your implementation DAR
await ledger.uploadDarFile(minimalTokenDar);

// 3. Get disclosed contracts (e.g., for locked tokens)
const disclosure = await getTransferInstructionDisclosure(
    adminLedger,
    transferInstructionCid
);

// Note: disclosure.lockedTokenDisclosure.templateId is in package-id reference format
// Example: "0d72f4c1...ab04c17d:MyToken:LockedMyToken"

// 4. Exercise interface choice (uses package-name format with # prefix)
const command: ExerciseCommand = {
    templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,  // "#splice-api-token-transfer-instruction-v1:..."
    contractId: transferInstructionCid,
    choice: 'TransferInstruction_Accept',
    choiceArgument: {
        extraArgs: {
            context: disclosure.choiceContext,
            meta: { values: {} },
        },
    },
};

await ledger.prepareSignExecuteAndWaitFor(
    [command],
    privateKey,
    uuid(),
    [disclosure.lockedTokenDisclosure]  // templateId here is in package-id reference format
);
```

## Interface Choice Patterns in Splice

The splice-wallet-kernel implements several interface choice patterns:

### Transfer Instructions

- **Accept**: `TransferInstruction_Accept` (lines 804-814)
- **Reject**: `TransferInstruction_Reject` (lines 991-1001)
- **Withdraw**: `TransferInstruction_Withdraw` (lines 1071-1081)

All use:
- Interface ID: `TRANSFER_INSTRUCTION_INTERFACE_ID`
- Choice context from registry API
- Disclosed contracts for hidden dependencies

### Allocations (DvP)

- **Execute**: `Allocation_ExecuteTransfer` (lines 444-450)
- **Withdraw**: `Allocation_Withdraw` (lines 490-496)
- **Cancel**: `Allocation_Cancel` (lines 536-542)

All use:
- Interface ID: `ALLOCATION_INTERFACE_ID`
- Choice context with disclosed contracts
- Multi-party authorization

### Factory Operations

- **Transfer Factory**: `TransferFactory_Transfer` (lines 710-716)
- **Allocation Factory**: `AllocationFactory_Allocate` (lines 356-362)

Both use:
- Interface IDs for factories
- Registry API for choice context
- Disclosed contracts for locked holdings

## Choice Context Pattern

Splice uses a **registry API** to provide choice context and disclosed contracts:

```typescript
// 1. Fetch context from registry
const choiceContext = await client.post(
    '/registry/transfer-instruction/v1/{transferInstructionId}/choice-contexts/accept',
    {},
    { path: { transferInstructionId: transferInstructionCid } }
);

// 2. Use context in choice argument
const exercise: ExerciseCommand = {
    templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,
    contractId: transferInstructionCid,
    choice: 'TransferInstruction_Accept',
    choiceArgument: {
        extraArgs: {
            context: choiceContext.choiceContextData,  // From registry
            meta: { values: {} },
        },
    },
};

// 3. Include disclosed contracts
return [exercise, choiceContext.disclosedContracts];
```

This pattern:
- Centralizes contract disclosure logic in the registry
- Provides additional context needed for complex workflows
- Ensures all parties have visibility to required contracts

## Why Interface Choices?

Using interface choices instead of concrete template choices provides:

1. **Flexibility**: Implementations can change without breaking client code
2. **Standardization**: All CIP-0056 tokens use the same interface
3. **Composability**: Applications work with any token implementing the interface
4. **Upgradeability**: New implementations can be deployed without client changes

## Common Errors and Solutions

### Error: "Invalid template:...:MyTransferInstruction or choice:TransferInstruction_Accept"

**Cause**: Using interface choice name with concrete template ID

**Solution**: Use interface template ID, not concrete template ID

```typescript
// Wrong
templateId: "#0d72f4c1...ab04c17d:MyTokenTransferInstruction:MyTransferInstruction",
choice: "TransferInstruction_Accept",  // Interface choice

// Correct
templateId: "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction",
choice: "TransferInstruction_Accept",
```

### Error: "Package not found" or similar

**Cause**: Interface package DAR not uploaded to ledger

**Solution**: Ensure all Splice API interface DARs are uploaded to the ledger before exercising interface choices. The required DARs include:
- `splice-api-token-metadata-v1.dar`
- `splice-api-token-holding-v1.dar`
- `splice-api-token-transfer-instruction-v1.dar`
- `splice-api-token-allocation-v1.dar`
- `splice-api-token-allocation-instruction-v1.dar`

## Architecture Notes

### Token Standard Service Structure

The `TokenStandardService` class (lines 1120-1662) provides:

- **Core Service**: Ledger client operations, contract queries
- **Transfer Service**: Transfer instruction operations
- **Allocation Service**: Allocation and DvP operations

Each service:
- Returns `[ExerciseCommand, DisclosedContract[]]` tuples
- Fetches choice context from registry APIs
- Handles disclosed contracts automatically

### Integration Points

1. **Registry APIs**: Provide choice context and disclosed contracts
2. **Scan Proxy**: Query for contract state and metadata
3. **Ledger Client**: Execute commands with disclosed contracts
4. **Access Token Provider**: Authenticate with services

## Key Insights and Lessons Learned

### Interface Choices Work Differently Than Expected

Canton's Ledger API **directly supports exercising interface choices** without requiring explicit choice definitions on concrete templates. This is a crucial distinction from what many developers might initially expect:

- **You don't need to add explicit choices** to your concrete template (e.g., `MyTransferInstruction`)
- **Interface choices are invoked directly** using the interface template ID
- **The interface package must be on the ledger** for choice resolution to work
- **This enables true polymorphism** - clients work with interfaces, not concrete implementations

This design provides flexibility and upgradeability: new token implementations can be deployed without changing client code, as long as they implement the same interfaces.

### The Importance of Reference Implementations

When working with complex Canton patterns like interface choices and disclosed contracts, **studying production code is invaluable**:

- The `splice-wallet-kernel` repository shows real-world usage patterns
- Seeing how `ExerciseCommand` structures are built clarifies API requirements
- Production code reveals subtleties not obvious from documentation alone
- Common patterns (like the registry API for choice context) become clear

**Key takeaway**: When debugging Canton integration issues, look at how Splice implements the same patterns. Their code has been battle-tested in production.

### Disclosed Contracts Are a Distinct Concept

`DisclosedContract` objects have different requirements than regular commands:

1. **Template ID format is different**: They require package-ID reference format (`{64-char-hex}:Module:Template`), not the query format (`#package-name:Module:Template`)

2. **You can't construct them from constants**: The `templateId` must come from `createdEvent.templateId` returned by the ledger

3. **They serve a specific purpose**: Disclosed contracts make contracts visible to parties who wouldn't normally see them (because they're not signatories or observers)

4. **Context matters**: The same contract needs different template ID formats depending on whether you're:
   - Querying for it (use `#package-name:...`)
   - Disclosing it (use package-ID reference from `createdEvent.templateId`)
   - Exercising a choice on it (use `#package-name:...`)

**Common pitfall**: Trying to use the same template ID constant for both queries and disclosed contracts will fail. Always use `createdEvent.templateId` for disclosed contracts.

## References

- [splice-wallet-kernel repository](https://github.com/hyperledger-labs/splice-wallet-kernel)
- [token-standard-service.ts](https://github.com/hyperledger-labs/splice-wallet-kernel/blob/main/core/ledger-client/src/token-standard-service.ts)
- [CIP-0056 Specification](https://github.com/global-synchronizer-foundation/cips/blob/main/cip-0056/cip-0056.md)
- [Splice Token Standard](https://github.com/hyperledger-labs/splice/tree/main/token-standard)
