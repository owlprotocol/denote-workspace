import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
} from "@denotecapital/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, issuer, seed } = await request.json();

        if (!contractId || !issuer || !seed) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            issuer,
            keyPair
        );

        await wrappedSdk.etf.mintRequest.decline(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error declining ETF mint request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
