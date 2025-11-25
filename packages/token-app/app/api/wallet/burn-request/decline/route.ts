import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, issuerPartyId, seed } = await request.json();

        if (!contractId || !issuerPartyId || !seed) {
            return NextResponse.json(
                { error: "Missing contractId, issuerPartyId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            issuerPartyId,
            keyPair
        );

        await wrappedSdk.issuerBurnRequest.decline(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error declining burn request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
