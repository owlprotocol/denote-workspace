import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, adminPartyId, seed } = await request.json();

        if (!contractId || !adminPartyId || !seed) {
            return NextResponse.json(
                { error: "Missing contractId, adminPartyId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            adminPartyId,
            keyPair
        );

        await wrappedSdk.transferRequest.decline(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error declining transfer request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
