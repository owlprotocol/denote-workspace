import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";

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

        await wrappedSdk.issuerBurnRequest.accept(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error accepting burn request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
