import { NextRequest, NextResponse } from "next/server";
import { getSDK } from "@/lib/wallet/sdk-instance";
import {
    keyPairFromSeed,
    getOrCreateTokenFactory,
} from "@owlprotocol/token-sdk";
import { logger } from "@/lib/wallet/sdk";

export async function POST(request: NextRequest) {
    try {
        const { instrumentId, seed } = await request.json();

        if (!instrumentId || !seed) {
            return NextResponse.json(
                { error: "Missing instrumentId or seed" },
                { status: 400 }
            );
        }

        const sdk = await getSDK();
        if (!sdk.userLedger) {
            return NextResponse.json(
                { error: "SDK not connected" },
                { status: 500 }
            );
        }

        // Extract party ID from instrumentId (format: "{partyId}#MyToken")
        // TODO: find better way
        const partyId = instrumentId.split("#")[0];
        if (!partyId) {
            return NextResponse.json(
                { error: "Invalid instrumentId format" },
                { status: 400 }
            );
        }

        await sdk.setPartyId(partyId);

        const keyPair = keyPairFromSeed(seed);
        const tokenFactoryContractId = await getOrCreateTokenFactory(
            sdk.userLedger,
            keyPair,
            instrumentId
        );

        return NextResponse.json({ tokenFactoryContractId });
    } catch (error) {
        logger.error({ err: error }, "Error getting/creating token factory");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
