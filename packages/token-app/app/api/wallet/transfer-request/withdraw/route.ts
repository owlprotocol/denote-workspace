import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, senderPartyId, seed } = await request.json();

        if (!contractId || !senderPartyId || !seed) {
            return NextResponse.json(
                { error: "Missing contractId, senderPartyId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            senderPartyId,
            keyPair
        );

        await wrappedSdk.transferRequest.withdraw(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error withdrawing transfer request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
