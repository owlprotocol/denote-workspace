import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { contractId, disclosure, receiverPartyId, seed } =
            await request.json();

        if (!contractId || !disclosure || !receiverPartyId || !seed) {
            return NextResponse.json(
                {
                    error: "Missing contractId, disclosure, receiverPartyId, or seed",
                },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            receiverPartyId,
            keyPair
        );

        await wrappedSdk.transferInstruction.accept(contractId, [disclosure]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error accepting transfer instruction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
