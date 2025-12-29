import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
} from "@denotecapital/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, requester, seed } = await request.json();

        if (!contractId || !requester || !seed) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            requester,
            keyPair
        );

        await wrappedSdk.etf.mintRequest.withdraw(contractId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error withdrawing ETF mint request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
