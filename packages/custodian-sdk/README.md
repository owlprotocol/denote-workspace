# Custodian SDK

Automated custodian service for Canton ledger request contracts. This service polls the Canton ledger every 60 seconds to detect new request contracts (mint, transfer, burn, bond lifecycle) and automatically approves them after mocking an external API call.

## Overview

The custodian service is designed to work alongside the `@packages/token-app/` demo:

1. **User creates request** via token-app web UI (e.g., mint request)
2. **Custodian detects** request on next poll cycle (every 60s)
3. **Mock API call** simulates external approval (1s delay)
4. **Custodian accepts** request using token-sdk
5. **User sees result** in token-app (e.g., tokens appear in balance)

## Request Types Handled

- **Token mint requests** (IssuerMintRequest) - Receiver proposes, issuer accepts
- **Token transfer requests** (TransferRequest) - Sender proposes, admin accepts
- **Token burn requests** (IssuerBurnRequest) - Owner proposes, issuer accepts
- **Bond mint requests** (BondIssuerMintRequest) - Receiver proposes, issuer accepts
- **Bond transfer requests** (BondTransferRequest) - Sender proposes, admin accepts
- **Bond lifecycle claims** (BondLifecycleClaimRequest) - Holder proposes, issuer accepts

## Prerequisites

Before running the custodian service, ensure:

1. **Localnet is running**: `pnpm start:localnet` from monorepo root
2. **Custodian private key**: You need a custodian private key (64-char hex string)

## Setup

### 1. Environment Configuration

Copy the example environment file and add your custodian private key:

```bash
cd packages/custodian-sdk
cp .env.example .env
```

Edit `.env` and set your custodian private key:

```
CUSTODIAN_PRIVATE_KEY=your_64_char_hex_private_key_here
```

### 2. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

## Usage

### Start the Custodian Service

From the monorepo root:

```bash
pnpm -C packages/custodian-sdk dev
```

Or from within the package directory:

```bash
cd packages/custodian-sdk
pnpm dev
```

**Expected Output:**

```
[CUSTODIAN] Service started
[CUSTODIAN] Party ID: party::custodian::12345...
[CUSTODIAN] Polling every 60000ms
[CUSTODIAN] Polling for new requests...
[CUSTODIAN] No new requests
```

### Integration with Token-App

1. Start the localnet (if not already running):
   ```bash
   pnpm start:localnet
   ```

2. Start the token-app in a separate terminal:
   ```bash
   pnpm -C packages/token-app dev
   ```

3. Start the custodian service in another terminal:
   ```bash
   pnpm -C packages/custodian-sdk dev
   ```

4. Open the token-app in your browser (usually http://localhost:3000)

5. Create a mint request via the web UI

6. Watch the custodian service logs - within 60 seconds, you'll see:
   ```
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

7. Check the token-app - tokens should appear in the user's balance

## Configuration

### Polling Frequency

The service polls the ledger every 60 seconds (60000ms). This is hard-coded in `src/index.ts`:

```typescript
const POLLING_FREQUENCY_MS = 60000; // 1 minute
```

To change the polling frequency, edit this constant and restart the service.

### API Mock Delay

The mock external API call simulates a 1-second delay. This is hard-coded in `src/index.ts`:

```typescript
const API_MOCK_DELAY_MS = 1000; // 1 second
```

### Watched Template IDs

The service watches 6 contract template IDs. These are imported from `@denotecapital/token-sdk`:

- `issuerMintRequestTemplateId`
- `transferRequestTemplateId`
- `issuerBurnRequestTemplateId`
- `bondIssuerMintRequestTemplateId`
- `bondTransferRequestTemplateId`
- `bondLifecycleClaimRequestTemplateId`

## Architecture

The service uses a simple functional approach:

- **Single file**: All logic is in `src/index.ts`
- **No classes**: Uses plain functions for simplicity
- **Switch statement**: Handles different request types based on templateId
- **In-memory state**: Tracks processed contracts in a Set
- **Mock API**: `custodianApi` object provides 6 mock approval methods

### Key Functions

- `initializeCustodian()` - Initializes SDK and allocates custodian party
- `pollForRequests()` - Queries activeContracts for all watched template IDs
- `handleRequest()` - Processes a single request (mock API + accept on ledger)
- `startCustodianService()` - Main service loop with setInterval

### Mock External API

The `custodianApi` object provides mock methods for each request type:

```typescript
const custodianApi = {
  approveMint,
  approveTransfer,
  approveBurn,
  approveBondMint,
  approveBondTransfer,
  approveBondLifecycleClaim,
};
```

Each method:
1. Logs request details (receiver, amount, etc.)
2. Simulates a 1-second API delay
3. Returns approval

**In production**, these methods would be replaced with real external API calls to a custodian system.

## Scripts

- `pnpm dev` - Start service with auto-reload on file changes
- `pnpm start` - Start service (no auto-reload)
- `pnpm build` - Compile TypeScript
- `pnpm lint` - Check for linting errors
- `pnpm lint:fix` - Auto-fix linting errors

## Future Enhancements

1. **Participant Query Store Integration** - Replace polling with real-time event subscriptions for better performance
2. **Advanced Approval Logic** - Configurable rules (amount limits, party whitelists, time restrictions)
3. **File-Based State Persistence** - Remember processed contracts across service restarts
4. **Metrics Export** - Track approval counts, failure rates, processing times

## Troubleshooting

### "CUSTODIAN_PRIVATE_KEY environment variable is required"

Make sure you've created a `.env` file with your custodian private key:

```bash
cd packages/custodian-sdk
cp .env.example .env
# Edit .env and add your private key
```

### No requests being detected

1. Check that the localnet is running: `pnpm start:localnet`
2. Check that the token-app is running: `pnpm -C packages/token-app dev`
3. Make sure you're creating requests via the web UI
4. Wait up to 60 seconds for the next poll cycle
5. Check the custodian service logs for any errors

### "Failed to generate custodian party"

This usually means:
- The localnet is not running
- The Canton ledger is not accessible
- There's a network connectivity issue

Make sure the localnet is running and accessible on `localhost:7575`.

## Development

The custodian service is built with:

- **TypeScript** - Type-safe development
- **tsx** - Fast TypeScript execution with auto-reload
- **dotenv** - Environment variable management
- **tweetnacl** - Cryptographic key derivation
- **@denotecapital/token-sdk** - Wrapped SDK functions for Canton ledger
- **@canton-network/wallet-sdk** - Low-level Canton SDK

## License

MIT
