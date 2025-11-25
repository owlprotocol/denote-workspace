import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { partyId, instrumentId, seed } = await request.json();

        if (!partyId || !instrumentId || !seed) {
            return NextResponse.json(
                { error: "Missing partyId, instrumentId, or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        const rulesCid = await wrappedSdk.tokenRules.getOrCreate();

        const transferFactoryCid = await wrappedSdk.transferFactory.getOrCreate(
            rulesCid
        );

        const tokenFactoryCid = await wrappedSdk.tokenFactory.getOrCreate(
            instrumentId
        );

        return NextResponse.json({
            rulesCid,
            transferFactoryCid,
            tokenFactoryCid,
        });
    } catch (error) {
        console.error("Error setting up token factory:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
