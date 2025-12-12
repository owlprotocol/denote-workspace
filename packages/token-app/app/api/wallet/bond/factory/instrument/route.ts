import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const {
            instrumentId,
            notional,
            couponRate,
            couponFrequency,
            maturityDate,
            partyId,
            seed,
        } = await request.json();

        if (
            !instrumentId ||
            notional === undefined ||
            couponRate === undefined ||
            couponFrequency === undefined ||
            !maturityDate ||
            !partyId ||
            !seed
        ) {
            return NextResponse.json(
                {
                    error: "Missing required fields",
                },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        const bondFactoryCid = await wrappedSdk.bonds.factory.getOrCreate(
            instrumentId
        );

        const bondInstrumentCid =
            await wrappedSdk.bonds.factory.createInstrument(
                bondFactoryCid,
                instrumentId,
                {
                    depository: partyId,
                    notional,
                    couponRate,
                    couponFrequency,
                    maturityDate,
                }
            );

        return NextResponse.json({
            bondInstrumentCid,
            bondFactoryCid,
        });
    } catch (error) {
        console.error("Error creating bond instrument:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
