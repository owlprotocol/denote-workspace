import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getDefaultSdkAndConnect,
    getWrappedSdkWithKeyPair,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { instrumentId, seed } = await request.json();

        if (!instrumentId || !seed) {
            return NextResponse.json(
                { error: "Missing instrumentId or seed" },
                { status: 400 }
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

        const keyPair = keyPairFromSeed(seed);
        const sdk = await getDefaultSdkAndConnect();
        await sdk.setPartyId(partyId);
        const wrappedSdk = getWrappedSdkWithKeyPair(sdk, keyPair);

        const tokenFactoryContractId =
            await wrappedSdk.tokenFactory.getOrCreate(instrumentId);

        return NextResponse.json({ tokenFactoryContractId });
    } catch (error) {
        console.error("Error getting/creating token factory:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
