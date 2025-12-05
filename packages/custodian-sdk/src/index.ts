import type { WalletSDK } from "@canton-network/wallet-sdk";
import { signTransactionHash } from "@canton-network/wallet-sdk";
import {
    ActiveContractResponse,
    BondIssuerMintRequestParams,
    bondIssuerMintRequestTemplateId,
    BondLifecycleClaimRequestParams,
    bondLifecycleClaimRequestTemplateId,
    BondTransferRequestParams,
    bondTransferRequestTemplateId,
    getDefaultSdkAndConnect,
    getWrappedSdkWithKeyPairForParty,
    IssuerBurnRequestParams,
    issuerBurnRequestTemplateId,
    IssuerMintRequestParams,
    issuerMintRequestTemplateId,
    TransferRequestParams,
    transferRequestTemplateId,
    WrappedSdkWithKeyPair,
    type UserKeyPair,
} from "@denotecapital/token-sdk";
import dotenv from "dotenv";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import { custodianApi } from "./custodianApi.js";
import { Request } from "./types/Request.js";

// Load environment variables
dotenv.config();

// Hard-coded configuration constants
const POLLING_FREQUENCY_MS = 60000; // 1 minute
export const API_MOCK_DELAY_MS = 1000; // 1 second

// Validate environment variables
const CUSTODIAN_PRIVATE_KEY = process.env.CUSTODIAN_PRIVATE_KEY;
if (!CUSTODIAN_PRIVATE_KEY) {
    throw new Error("CUSTODIAN_PRIVATE_KEY environment variable is required");
}

// Watched template IDs
const WATCHED_TEMPLATE_IDS = [
    issuerMintRequestTemplateId,
    transferRequestTemplateId,
    issuerBurnRequestTemplateId,
    bondIssuerMintRequestTemplateId,
    bondTransferRequestTemplateId,
    bondLifecycleClaimRequestTemplateId,
];

// In-memory set to track processed contracts
const processedContracts = new Set<string>();

// Initialize SDK and custodian party
async function initializeCustodian() {
    const sdk = await getDefaultSdkAndConnect();

    // Derive public key from private key using tweetnacl
    const secretKey = Buffer.from(CUSTODIAN_PRIVATE_KEY!, "hex");
    const keyPairDerived = nacl.box.keyPair.fromSecretKey(secretKey);

    const keyPair: UserKeyPair = {
        privateKey: encodeBase64(secretKey),
        publicKey: encodeBase64(keyPairDerived.publicKey),
    };

    // Allocate custodian party
    const custodianParty = await sdk.userLedger!.generateExternalParty(
        keyPair.publicKey
    );
    if (!custodianParty) throw new Error("Failed to generate custodian party");

    // Sign and allocate party
    const signedHash = signTransactionHash(
        custodianParty.multiHash,
        keyPair.privateKey
    );
    const allocatedParty = await sdk.userLedger!.allocateExternalParty(
        signedHash,
        custodianParty
    );

    // Set party ID on SDK
    await sdk.setPartyId(allocatedParty.partyId);

    // Get wrapped SDK
    const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
        allocatedParty.partyId,
        keyPair
    );

    return { sdk, wrappedSdk, custodianParty: allocatedParty };
}

// Poll for new requests
async function pollForRequests(sdk: WalletSDK, custodianPartyId: string) {
    // NOTE: Currently using polling approach (activeContracts every 60s).
    // In production, migrate to Canton Participant Query Store for
    // real-time event subscriptions and better performance.

    const newRequests: Request[] = [];

    const { offset } = await sdk.userLedger!.ledgerEnd();

    // Query all watched template IDs in a single call
    const response = (await sdk.userLedger!.activeContracts({
        templateIds: WATCHED_TEMPLATE_IDS,
        filterByParty: true,
        parties: [custodianPartyId],
        offset,
    })) as ActiveContractResponse[];

    // Process each contract based on its template ID
    response.forEach(({ contractEntry }) => {
        if (!contractEntry.JsActiveContract) return;

        const { contractId, templateId, createArgument } =
            contractEntry.JsActiveContract.createdEvent;

        if (!processedContracts.has(contractId)) {
            newRequests.push({
                contractId,
                templateId,
                createArgument,
            });
        }
    });

    return newRequests;
}

// Handle request based on template ID
async function handleRequest(
    request: Request,
    wrappedSdk: WrappedSdkWithKeyPair
) {
    const { contractId, templateId } = request;

    console.log(`[CUSTODIAN] Processing ${templateId}`);
    console.log(`[CUSTODIAN]   Contract ID: ${contractId}`);

    // Switch on template ID to determine which handler to use
    switch (templateId) {
        case issuerMintRequestTemplateId:
            // Call external API for approval
            await custodianApi.approveMint(
                request as unknown as Request<IssuerMintRequestParams>
            );
            // Accept on ledger
            await wrappedSdk.issuerMintRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted IssuerMintRequest`);
            break;

        case transferRequestTemplateId:
            await custodianApi.approveTransfer(
                request as unknown as Request<TransferRequestParams>
            );
            await wrappedSdk.transferRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted TransferRequest`);
            break;

        case issuerBurnRequestTemplateId:
            await custodianApi.approveBurn(
                request as unknown as Request<IssuerBurnRequestParams>
            );
            await wrappedSdk.issuerBurnRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted IssuerBurnRequest`);
            break;

        case bondIssuerMintRequestTemplateId:
            await custodianApi.approveBondMint(
                request as unknown as Request<BondIssuerMintRequestParams>
            );
            await wrappedSdk.bonds.issuerMintRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted BondIssuerMintRequest`);
            break;

        case bondTransferRequestTemplateId:
            await custodianApi.approveBondTransfer(
                request as unknown as Request<BondTransferRequestParams>
            );
            await wrappedSdk.bonds.transferRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted BondTransferRequest`);
            break;

        case bondLifecycleClaimRequestTemplateId:
            await custodianApi.approveBondLifecycleClaim(
                request as unknown as Request<BondLifecycleClaimRequestParams>
            );
            await wrappedSdk.bonds.lifecycleClaimRequest.accept(contractId);
            console.log(`[CUSTODIAN] ✓ Accepted BondLifecycleClaimRequest`);
            break;

        default:
            console.warn(`[CUSTODIAN] Unknown template ID: ${templateId}`);
    }

    // Mark as processed
    processedContracts.add(contractId);
}

// Main service loop
async function startCustodianService() {
    const { sdk, wrappedSdk, custodianParty } = await initializeCustodian();

    console.log(`[CUSTODIAN] Service started`);
    console.log(`[CUSTODIAN] Party ID: ${custodianParty.partyId}`);
    console.log(`[CUSTODIAN] Polling every ${POLLING_FREQUENCY_MS}ms`);

    // Polling loop
    async function startPollingLoop() {
        while (true) {
            // Keep polling indefinitely
            try {
                console.log(`[CUSTODIAN] Polling for new requests...`);

                const requests = await pollForRequests(
                    sdk,
                    custodianParty.partyId
                );

                if (requests.length > 0) {
                    console.log(
                        `[CUSTODIAN] Found ${requests.length} new request(s)`
                    );

                    for (const request of requests) {
                        try {
                            await handleRequest(request, wrappedSdk);
                        } catch (error) {
                            console.error(
                                `[CUSTODIAN] Error handling ${request.contractId}:`,
                                error
                            );
                            // Don't mark as processed - will retry next poll
                        }
                        // The interval happens after every handleRequest call
                        await new Promise((resolve) =>
                            setTimeout(resolve, POLLING_FREQUENCY_MS)
                        );
                    }
                } else {
                    console.log(`[CUSTODIAN] No new requests`);
                    // If no requests, still wait for the interval before the next poll
                    await new Promise((resolve) =>
                        setTimeout(resolve, POLLING_FREQUENCY_MS)
                    );
                }
            } catch (error) {
                console.error(`[CUSTODIAN] Polling error:`, error);
                // If polling itself fails, wait for the interval before retrying the poll
                await new Promise((resolve) =>
                    setTimeout(resolve, POLLING_FREQUENCY_MS)
                );
            }
        }
    }

    // Start the polling process
    await startPollingLoop();
}

// Start the service
startCustodianService().catch(console.error);
