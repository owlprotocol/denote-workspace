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
        const currencyInstrumentId = searchParams.get("currencyInstrumentId");

        if (!partyId || !seed || !currencyInstrumentId) {
            return NextResponse.json(
                { error: "Missing partyId, seed, or currencyInstrumentId" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        const bondRulesCid = await wrappedSdk.bonds.bondRules.getLatest();
        if (!bondRulesCid) {
            throw new Error(
                "Bond rules not found. Please run setup script first."
            );
        }

        const currencyRulesCid = await wrappedSdk.tokenRules.getLatest();
        if (!currencyRulesCid) {
            throw new Error(
                "Currency rules not found. Please run setup script first."
            );
        }

        const currencyTransferFactoryCid =
            await wrappedSdk.transferFactory.getLatest(currencyRulesCid);
        if (!currencyTransferFactoryCid) {
            throw new Error(
                "Currency transfer factory not found. Please run setup script first."
            );
        }

        const currencyBalance = await wrappedSdk.balances.getByInstrumentId({
            owner: partyId,
            instrumentId: { admin: partyId, id: currencyInstrumentId },
        });

        const currencyHoldings = currencyBalance.utxos.map((u) => u.contractId);

        return NextResponse.json({
            bondRulesCid,
            currencyTransferFactoryCid,
            currencyHoldings,
        });
    } catch (error) {
        console.error("Error getting bond lifecycle infrastructure:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
