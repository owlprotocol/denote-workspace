import {
    BondIssuerMintRequestParams,
    BondLifecycleClaimRequestParams,
    BondTransferRequestParams,
    IssuerBurnRequestParams,
    IssuerMintRequestParams,
    TransferRequestParams,
} from "@denotecapital/token-sdk";
import { Request } from "./types/Request.js";
import { API_MOCK_DELAY_MS } from "./index.js";

// Mock external custodian API SDK
export const custodianApi = {
    async approveMint(request: Request<IssuerMintRequestParams>) {
        console.log(`[CUSTODIAN_API] Calling external API to approve mint...`);
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(
            `[CUSTODIAN_API]   Receiver: ${request.createArgument.receiver}`
        );
        console.log(
            `[CUSTODIAN_API]   Amount: ${request.createArgument.amount}`
        );

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Mint approved`);
        return true;
    },

    async approveTransfer(request: Request<TransferRequestParams>) {
        console.log(
            `[CUSTODIAN_API] Calling external API to approve transfer...`
        );
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(
            `[CUSTODIAN_API]   Sender: ${request.createArgument.transfer?.sender}`
        );
        console.log(
            `[CUSTODIAN_API]   Receiver: ${request.createArgument.transfer?.receiver}`
        );
        console.log(
            `[CUSTODIAN_API]   Amount: ${request.createArgument.transfer?.amount}`
        );

        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Transfer approved`);
        return true;
    },

    async approveBurn(request: Request<IssuerBurnRequestParams>) {
        console.log(`[CUSTODIAN_API] Calling external API to approve burn...`);
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(`[CUSTODIAN_API]   Owner: ${request.createArgument.owner}`);
        console.log(
            `[CUSTODIAN_API]   Amount: ${request.createArgument.amount}`
        );

        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Burn approved`);
        return true;
    },

    async approveBondMint(request: Request<BondIssuerMintRequestParams>) {
        console.log(
            `[CUSTODIAN_API] Calling external API to approve bond mint...`
        );
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(
            `[CUSTODIAN_API]   Receiver: ${request.createArgument.receiver}`
        );
        console.log(
            `[CUSTODIAN_API]   Amount: ${request.createArgument.amount}`
        );

        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Bond mint approved`);
        return true;
    },

    async approveBondTransfer(request: Request<BondTransferRequestParams>) {
        console.log(
            `[CUSTODIAN_API] Calling external API to approve bond transfer...`
        );
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(
            `[CUSTODIAN_API]   Sender: ${request.createArgument.transfer?.sender}`
        );
        console.log(
            `[CUSTODIAN_API]   Receiver: ${request.createArgument.transfer?.receiver}`
        );

        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Bond transfer approved`);
        return true;
    },

    async approveBondLifecycleClaim(
        request: Request<BondLifecycleClaimRequestParams>
    ) {
        console.log(
            `[CUSTODIAN_API] Calling external API to approve bond lifecycle claim...`
        );
        console.log(`[CUSTODIAN_API]   Request ID: ${request.contractId}`);
        console.log(
            `[CUSTODIAN_API]   Holder: ${request.createArgument.holder}`
        );

        await new Promise((resolve) => setTimeout(resolve, API_MOCK_DELAY_MS));

        console.log(`[CUSTODIAN_API] ✓ Bond lifecycle claim approved`);
        return true;
    },
};
