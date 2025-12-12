import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const seed = searchParams.get("seed");

        if (!partyId || !seed) {
            return NextResponse.json(
                { error: "Missing partyId or seed" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        // TODO: change to not hardcode the currency instrument id
        const currencyInstrumentId = `${partyId}#Currency`;

        const lifecycleRuleCid = await wrappedSdk.bonds.lifecycleRule.getLatest(
            {
                depository: partyId,
                currencyInstrumentId: {
                    admin: partyId,
                    id: currencyInstrumentId,
                },
            }
        );

        return NextResponse.json({
            lifecycleRuleCid: lifecycleRuleCid || null,
        });
    } catch (error) {
        console.error("Error getting lifecycle rule:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
