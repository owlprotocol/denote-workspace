import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const bondInstrumentCid = searchParams.get("bondInstrumentCid");
        const adminPartyId = searchParams.get("adminPartyId");

        if (!bondInstrumentCid || !adminPartyId) {
            return NextResponse.json(
                { error: "Missing bondInstrumentCid or adminPartyId" },
                { status: 400 }
            );
        }

        // TODO: change to not hardcode the custodian seed
        const keyPair = keyPairFromSeed("custodian");
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            adminPartyId,
            keyPair
        );

        const disclosure =
            await wrappedSdk.bonds.disclosure.getInstrumentDisclosure(
                bondInstrumentCid
            );

        return NextResponse.json({ disclosure });
    } catch (error) {
        console.error("Error getting bond disclosure:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
