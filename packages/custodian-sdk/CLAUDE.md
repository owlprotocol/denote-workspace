# CLAUDE.md - Custodian SDK

This file provides guidance to Claude Code (claude.ai/code) when working with the custodian service implementation.

## Project Overview

The custodian-sdk is an automated service that polls the Canton ledger for pending request contracts and automatically approves them after mocking external API calls. It is designed to work alongside the `@packages/token-app/` web application, providing automated custodian approval for token and bond operations.

## Architecture

### Core Components

**Main Service (`src/index.ts`)**
- Single-file functional approach (no classes)
- Polls Canton ledger every 60 seconds using `activeContracts()`
- Tracks processed contracts in-memory using a `Set`
- Handles 6 different request types via handler map pattern
- Uses async/await polling loop instead of setInterval

**Custodian API Mock (`src/custodianApi.ts`)**
- Provides 6 mock external API approval methods
- Each method logs request-specific details and simulates 1-second delay
- In production, these would be replaced with real external API calls
- Methods: `approveMint`, `approveTransfer`, `approveBurn`, `approveBondMint`, `approveBondTransfer`, `approveBondLifecycleClaim`

**Type Definitions (`src/types/Request.ts`)**
- Generic `Request<ContractParams>` interface
- Typed contract parameters from `@denotecapital/token-sdk`
- Handler map pattern with typed request handlers for each template ID

### Request Types Handled

The service automatically approves 6 request types:

1. **IssuerMintRequest** - Token minting (receiver proposes, issuer accepts)
2. **TransferRequest** - Token transfers (sender proposes, admin accepts)
3. **IssuerBurnRequest** - Token burning (owner proposes, issuer accepts)
4. **BondIssuerMintRequest** - Bond minting (receiver proposes, issuer accepts)
5. **BondTransferRequest** - Bond transfers (sender proposes, admin accepts)
6. **BondLifecycleClaimRequest** - Bond lifecycle claims (holder proposes, issuer accepts)

### Service Flow

1. **Initialization** (`initializeCustodian`)
   - Load `CUSTODIAN_PRIVATE_KEY` from environment
   - Derive public key using `nacl.box.keyPair.fromSecretKey()`
   - Connect to Canton ledger via `getDefaultSdkAndConnect()`
   - Allocate custodian party on ledger
   - Create wrapped SDK with key pair

2. **Polling Loop** (`pollForRequests`)
   - Query `activeContracts()` with all 6 template IDs in a single call
   - Filter contracts already in `processedContracts` Set
   - Return new requests for processing
   - **Important**: Includes comment about future Canton Participant Query Store (PQS) integration

3. **Request Handling** (`handleRequest`)
   - Lookup handler from `REQUEST_HANDLER` map using `templateId`
   - Each handler is properly typed for its specific request type
   - Handler calls corresponding `custodianApi.approve*()` method (mock external API)
   - Handler calls `wrappedSdk.*.accept()` to accept on ledger
   - Mark contract as processed in `processedContracts` Set

4. **Main Loop** (`startCustodianService`)
   - Initialize custodian
   - Start infinite polling loop with 60-second intervals
   - Handle errors gracefully (log and retry)
   - Support graceful shutdown (SIGINT)

## Configuration

### Environment Variables

**Required:**
- `CUSTODIAN_PRIVATE_KEY` - Custodian's Ed25519 private key (base64-encoded string)

**Loading:**
```typescript
import dotenv from 'dotenv';
dotenv.config();
```

### Hard-Coded Constants

Defined at top of `src/index.ts`:

```typescript
const POLLING_FREQUENCY_MS = 60000; // 1 minute
export const API_MOCK_DELAY_MS = 1000; // 1 second
```

**Note**: `API_MOCK_DELAY_MS` is exported so `custodianApi.ts` can import it.

### Watched Template IDs

```typescript
const WATCHED_TEMPLATE_IDS = [
  issuerMintRequestTemplateId,
  transferRequestTemplateId,
  issuerBurnRequestTemplateId,
  bondIssuerMintRequestTemplateId,
  bondTransferRequestTemplateId,
  bondLifecycleClaimRequestTemplateId,
];
```

These are imported from `@denotecapital/token-sdk` and represent the 6 contract types the service monitors.

## Code Organization

### Import Order

The `src/index.ts` file follows a consistent import organization pattern for better readability and tree-shaking:

1. **Canton SDK types** - Import type definitions first
   ```typescript
   import type { WalletSDK } from "@canton-network/wallet-sdk";
   ```

2. **Canton SDK functions** - Import runtime functions
   ```typescript
   import { signTransactionHash } from "@canton-network/wallet-sdk";
   ```

3. **Token SDK imports** - Organized alphabetically by name
   ```typescript
   import {
     ActiveContractResponse,
     BondIssuerMintRequestParams,
     bondIssuerMintRequestTemplateId,
     // ... (alphabetically sorted)
   } from "@denotecapital/token-sdk";
   ```

4. **External libraries** - Third-party dependencies
   ```typescript
   import dotenv from "dotenv";
   import nacl from "tweetnacl";
   import { decodeBase64, encodeBase64 } from "tweetnacl-util";
   ```

5. **Local imports** - Project-specific modules
   ```typescript
   import { custodianApi } from "./custodianApi.js";
   import { Request } from "./types/Request.js";
   ```

### Function Structure

Functions use clean patterns for better readability:

- **Early destructuring** - Extract values at function start
  ```typescript
  async function handleRequest(request: Request, wrappedSdk: WrappedSdkWithKeyPair) {
    const { contractId, templateId } = request; // Destructure first
    // ... use contractId and templateId directly
  }
  ```

- **Direct imports** - No dynamic imports for better performance
  ```typescript
  // Good: Direct import at top
  import { signTransactionHash } from "@canton-network/wallet-sdk";

  // Avoid: Dynamic import inside function
  // const { signTransactionHash } = await import("@canton-network/wallet-sdk");
  ```

## Key Design Decisions

### 1. Functional Approach (No Classes)

The service uses plain functions instead of classes for simplicity:
- Easy to understand and modify
- No complex OOP patterns
- Single file with clear function boundaries
- Extracted `custodianApi` for separation of concerns

### 2. Single activeContracts Call

Instead of querying each template ID separately, the service queries all 6 template IDs in a single `activeContracts()` call for efficiency:

```typescript
const response = await sdk.userLedger!.activeContracts({
  templateIds: WATCHED_TEMPLATE_IDS,
  filterByParty: true,
  parties: [custodianPartyId],
  offset,
});
```

### 3. Async/Await Polling Loop

Uses `while (true)` with `await` instead of `setInterval` for better control:

```typescript
async function startPollingLoop() {
  while (true) {
    try {
      // Poll and process requests
      await new Promise(resolve => setTimeout(resolve, POLLING_FREQUENCY_MS));
    } catch (error) {
      // Handle errors and continue
    }
  }
}
```

**Benefits:**
- Sequential processing of requests
- Better error handling
- Easier to add delays between operations
- Natural async/await flow

### 4. Handler Map Pattern for Type-Safe Request Handling

Uses a handler map pattern where each `templateId` maps to a typed handler function:

```typescript
// Type for a handler function
type RequestHandler<T extends Record<string, unknown>> = (
  request: Request<T>,
  wrappedSdk: WrappedSdkWithKeyPair
) => Promise<void>;

// Handler map with proper types for each request type
const REQUEST_HANDLER = {
  [issuerMintRequestTemplateId]: async (
    request: Request<IssuerMintRequestParams>,
    wrappedSdk: WrappedSdkWithKeyPair
  ) => {
    await custodianApi.approveMint(request);
    await wrappedSdk.issuerMintRequest.accept(request.contractId);
    console.log(`[CUSTODIAN] ✓ Accepted IssuerMintRequest`);
  },
  // ... 5 more handlers
} satisfies Record<string, RequestHandler<any>>;

// Simplified handleRequest - just lookup and invoke
async function handleRequest(request: Request, wrappedSdk: WrappedSdkWithKeyPair) {
  const { contractId, templateId } = request;

  if (!(templateId in REQUEST_HANDLER)) {
    console.warn(`[CUSTODIAN] No handler for template ID: ${templateId}`);
    return;
  }

  const handler = REQUEST_HANDLER[templateId as keyof typeof REQUEST_HANDLER];
  await handler(request as Request<any>, wrappedSdk);
  processedContracts.add(contractId);
}
```

**Benefits:**
- Each handler has proper types built-in (no `as unknown as` double cast needed)
- Handler map is more concise than switch statement
- Single `as Request<any>` cast at invocation point (contained in one place)
- Easy to add new request types (just add to map)
- Uses `satisfies` for type checking the handler map structure

### 5. In-Memory State Tracking

Processed contracts are tracked in a `Set<string>`:

```typescript
const processedContracts = new Set<string>();
```

**Pros:**
- Simple and fast
- No external dependencies
- Low complexity for MVP

**Cons:**
- State lost on restart
- No shared state across multiple instances

**Future Enhancement:** File-based persistence for service restarts.

### 6. Mock External API SDK

The `custodianApi` object provides a clean interface for external API calls:

```typescript
await custodianApi.approveMint(request);
```

**Production Replacement:**
- Replace mock methods with real API client
- Keep same interface for minimal code changes
- Add authentication, retry logic, error handling
- Implement actual approval workflows

## Integration with Token-App

The custodian service is designed to work alongside the token-app web application:

1. **User action** (token-app web UI): Create mint/transfer/burn request
2. **Contract creation** (Canton ledger): Request contract created on-chain
3. **Custodian detection** (custodian-sdk): Service detects new request on next poll (≤60s)
4. **Mock API call** (custodian-sdk): Simulates external approval (1s delay)
5. **Ledger acceptance** (custodian-sdk): Accepts request using token-sdk
6. **User feedback** (token-app web UI): Balance updates, operation completes

## Development Commands

```bash
# Start with auto-reload
pnpm dev

# Start without auto-reload
pnpm start

# Build TypeScript
pnpm build

# Lint code
pnpm lint

# Fix lint errors
pnpm lint:fix

# Check circular dependencies
pnpm madge

# Clean build artifacts
pnpm clean
```

## Testing Strategy

### Manual Testing with Token-App

1. Start localnet: `pnpm start:localnet`
2. Start token-app: `pnpm -C packages/token-app dev`
3. Start custodian: `pnpm -C packages/custodian-sdk dev`
4. Create requests via token-app web UI
5. Observe custodian logs for detection and approval
6. Verify operations complete in token-app UI

### Expected Log Output

**Startup:**
```
[CUSTODIAN] Service started
[CUSTODIAN] Party ID: party::custodian::12345...
[CUSTODIAN] Polling every 60000ms
```

**Polling (no requests):**
```
[CUSTODIAN] Polling for new requests...
[CUSTODIAN] No new requests
```

**Request detected and processed:**
```
[CUSTODIAN] Polling for new requests...
[CUSTODIAN] Found 1 new request(s)
[CUSTODIAN] Processing #minimal-token:MyToken.IssuerMintRequest:IssuerMintRequest
[CUSTODIAN]   Contract ID: 00abc123...
[CUSTODIAN_API] Calling external API to approve mint...
[CUSTODIAN_API]   Request ID: 00abc123...
[CUSTODIAN_API]   Receiver: party::alice::67890...
[CUSTODIAN_API]   Amount: 100
[CUSTODIAN_API] ✓ Mint approved
[CUSTODIAN] ✓ Accepted IssuerMintRequest
```

## Canton Integration Notes

### Key Pair Derivation

The service uses `tweetnacl` for key derivation:

```typescript
// CUSTODIAN_PRIVATE_KEY should be a base64-encoded string
const secretKeyBase64 = CUSTODIAN_PRIVATE_KEY!;
const secretKey = decodeBase64(secretKeyBase64);
const keyPairDerived = nacl.box.keyPair.fromSecretKey(secretKey);

const keyPair: UserKeyPair = {
  privateKey: secretKeyBase64,
  publicKey: encodeBase64(keyPairDerived.publicKey),
};
```

**Important:**
- `CUSTODIAN_PRIVATE_KEY` must be base64-encoded (not hex)
- Private key is used directly as base64 string (no re-encoding needed)
- Public key is derived and base64-encoded for Canton SDK compatibility

### Party Allocation

Custodian party is allocated on-chain:

```typescript
import { signTransactionHash } from "@canton-network/wallet-sdk";

// Generate party from public key
const custodianParty = await sdk.userLedger!.generateExternalParty(keyPair.publicKey);

// Sign multi-hash
const signedHash = signTransactionHash(custodianParty.multiHash, keyPair.privateKey);

// Allocate party on ledger
const allocatedParty = await sdk.userLedger!.allocateExternalParty(signedHash, custodianParty);
```

**Note:** `signTransactionHash` is now imported directly at the top of the file instead of using dynamic import, which improves performance and enables better tree-shaking.

### Active Contracts Query

The service uses the ledger end offset for efficient querying:

```typescript
const { offset } = await sdk.userLedger!.ledgerEnd();

const response = await sdk.userLedger!.activeContracts({
  templateIds: WATCHED_TEMPLATE_IDS,
  filterByParty: true,
  parties: [custodianPartyId],
  offset,
});
```

### Response Processing

Active contract responses have nested structure:

```typescript
response.forEach(({ contractEntry }) => {
  if (!contractEntry.JsActiveContract) return;

  const { contractId, templateId, createArgument } =
    contractEntry.JsActiveContract.createdEvent;

  // Process contract...
});
```

## Future Enhancements

### 1. Canton Participant Query Store (PQS)

Currently using polling (`activeContracts` every 60s). **Production should use PQS for real-time event subscriptions:**

```typescript
// Future: Replace polling with PQS event stream
pqsClient.subscribeToCreateEvents({
  templateIds: WATCHED_TEMPLATE_IDS,
  onEvent: (event) => handleRequest(event, wrappedSdk),
});
```

**Benefits:**
- Real-time event detection (no 60s delay)
- Lower resource usage (no constant polling)
- More scalable for high-volume systems

**Implementation Note:** The comment in `pollForRequests()` marks this as a future improvement.

### 2. File-Based State Persistence

Track processed contracts in a file for service restarts:

```typescript
// Load state on startup
const processedContracts = await loadProcessedContracts();

// Persist after each approval
await persistProcessedContracts(processedContracts);
```

### 3. Advanced Approval Logic

Replace always-approve mock with configurable rules:

```typescript
interface ApprovalRule {
  type: 'amount' | 'party' | 'time';
  condition: any;
}

async function shouldApprove(request: Request): Promise<boolean> {
  // Check amount limits
  // Verify party whitelist
  // Validate time windows
  // Call external KYC/AML APIs
  return true/false;
}
```

### 4. Metrics and Monitoring

Add Prometheus-compatible metrics:

```typescript
const metrics = {
  totalProcessed: 0,
  totalApproved: 0,
  totalFailed: 0,
  byType: Map<string, number>,
  averageProcessingTime: number,
};
```

### 5. Multi-Custodian Coordination

For distributed deployments:
- Shared state (Redis, database)
- Leader election (only one custodian processes each request)
- Load balancing across multiple custodians

## Common Issues and Troubleshooting

### "CUSTODIAN_PRIVATE_KEY environment variable is required"

**Cause:** `.env` file missing or empty

**Solution:**
```bash
cd packages/custodian-sdk
cp .env.example .env
# Edit .env and add your private key
```

### "Failed to generate custodian party"

**Causes:**
- Localnet not running
- Canton ledger not accessible
- Network connectivity issue

**Solution:**
```bash
# Ensure localnet is running
pnpm start:localnet

# Check ledger is accessible
curl http://localhost:7575/health
```

### No requests being detected

**Causes:**
- Token-app not creating requests
- Custodian not configured as issuer/admin
- Polling interval hasn't elapsed

**Debugging:**
1. Check token-app is running and creating requests
2. Verify custodian party ID matches issuer/admin in requests
3. Wait up to 60 seconds for next poll cycle
4. Check custodian logs for errors

### Type errors in handler map

**Cause:** Missing or incorrect handler function type annotations

**Solution:** Ensure each handler in `REQUEST_HANDLER` has proper type annotations:
```typescript
const REQUEST_HANDLER = {
  [issuerMintRequestTemplateId]: async (
    request: Request<IssuerMintRequestParams>,  // Type the request parameter
    wrappedSdk: WrappedSdkWithKeyPair
  ) => {
    await custodianApi.approveMint(request);
    await wrappedSdk.issuerMintRequest.accept(request.contractId);
  },
} satisfies Record<string, RequestHandler<any>>;
```

## Dependencies

### Runtime Dependencies
- `@canton-network/wallet-sdk` (^0.16.0) - Canton ledger interaction
- `@denotecapital/token-sdk` (workspace:*) - Token/bond operations
- `dotenv` (^16.4.7) - Environment variable management
- `tweetnacl` (^1.0.3) - Cryptographic key operations
- `tweetnacl-util` (^0.15.1) - Base64 encoding utilities

### Dev Dependencies
- `typescript` (5.8.2) - TypeScript compiler
- `tsx` (^4.19.2) - Fast TypeScript execution with watch mode
- `@veraswap/tsconfig` - Shared TypeScript configuration
- `@veraswap/eslint-config` - Shared ESLint configuration
- `@veraswap/esbuild-config` - Shared esbuild configuration

## Related Documentation

- **Token SDK**: `packages/token-sdk/CLAUDE.md` - Wrapped SDK functions and patterns
- **Token App**: `packages/token-app/README.md` - Web UI integration
- **Root Workspace**: `CLAUDE.md` - Monorepo overview and architecture

## Key Files

- `src/index.ts` - Main service implementation (286 lines)
  - Well-organized imports (Canton SDK → Token SDK → External libs → Local)
  - Handler map pattern for type-safe request processing
  - Clean function decomposition with early destructuring
  - Direct imports for better performance
- `src/custodianApi.ts` - Mock external API SDK (119 lines)
- `src/types/Request.ts` - Request type definitions (8 lines)
- `.env.example` - Environment variable template
- `package.json` - Dependencies and scripts
- `README.md` - User-facing documentation

## Contributing Guidelines

When modifying the custodian service:

1. **Maintain functional style** - Avoid adding classes
2. **Keep it simple** - Single file main implementation
3. **Import organization** - Follow the established pattern:
   - Canton SDK types first
   - Canton SDK functions
   - Token SDK imports (alphabetically)
   - External libraries
   - Local imports
4. **Handler map pattern** - Add new request types to `REQUEST_HANDLER` map with proper type annotations
5. **Type safety** - Use `RequestHandler<T>` type for new handlers, include `satisfies` clause
6. **Code style** - Use early destructuring for cleaner code
7. **Avoid dynamic imports** - Import directly at top for better tree-shaking
8. **Mock API** - Keep external API calls in `custodianApi.ts`
9. **Logging** - Use `[CUSTODIAN]` and `[CUSTODIAN_API]` prefixes
10. **Error handling** - Log errors, don't crash, retry on next poll
11. **Documentation** - Update README.md and CLAUDE.md for significant changes
