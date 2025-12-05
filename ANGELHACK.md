# Canton Token SDK: TypeScript Wrapper for CIP-0056 Tokens

SDK simplifying CIP-0056 token operations on Canton for tokenizing real-world assets. Wraps DAML contracts into an SDK handling multi-party authorization, token locking, and settlements. Supports tokens and bonds with lifecycle management. Enables RWA development using TypeScript without DAML expertise.

## Key problem

Canton token development requires deep DAML/Wallet SDK knowledge and complex orchestration. Multi-party authorization needs manual coordination. No easy TypeScript starter.

## Proposed solution and concept highlights

Namespaced API reducing ~50 lines to ~5. Automatic contract management, request/accept patterns avoiding multi-party signing, CIP-0056 compliance, disclosure helpers, bond lifecycle support.

## Further developments

React hooks, LedgerClient API for multi-party signing, additional assets (equity, commodities), CLI, REST/GraphQL layers, batch operations.
