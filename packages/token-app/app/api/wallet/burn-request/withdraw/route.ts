import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, ownerPartyId, seed } = await request.json();

        if (!contractId || !ownerPartyId || !seed) {
            return NextResponse.json(
                { error: "Missing contractId, ownerPartyId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            ownerPartyId,
            keyPair
        );

        await wrappedSdk.issuerBurnRequest.withdraw(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error withdrawing burn request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
