import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getWrappedSdkForParty,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");

        if (!partyId) {
            return NextResponse.json(
                { error: "Missing partyId" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(partyId);
        const instructions = await wrappedSdk.bonds.lifecycleInstruction.getAll(
            partyId
        );
        return NextResponse.json(instructions);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes("Bond lifecycle instruction not found")
        ) {
            return NextResponse.json([], { status: 200 });
        }
        console.error("Error getting lifecycle instruction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { contractId, partyId, seed, disclosure } = await request.json();

        if (!contractId || !partyId || !seed) {
            return NextResponse.json(
                { error: "Missing contractId, partyId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        await wrappedSdk.bonds.lifecycleInstruction.process(
            contractId,
            disclosure ? [disclosure] : undefined
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error processing lifecycle instruction:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
