import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getSdkForParty,
    bondLifecycleClaimRequestTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const issuer = searchParams.get("issuer");

        if (!partyId || !issuer) {
            return NextResponse.json(
                { error: "Missing partyId or issuer" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(partyId);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();

        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [bondLifecycleClaimRequestTemplateId],
        })) as ActiveContractResponse[];

        const requests = activeContracts
            .map((contract) => {
                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument as {
                    effectCid: string;
                    bondHoldingCid: string;
                    holder: string;
                    issuer: string;
                };
                const contractId = jsActive.createdEvent.contractId;

                if (createArg.issuer !== issuer) return null;

                return {
                    contractId,
                    effectCid: createArg.effectCid,
                    bondHoldingCid: createArg.bondHoldingCid,
                    holder: createArg.holder,
                    issuer: createArg.issuer,
                };
            })
            .filter((req): req is NonNullable<typeof req> => req !== null);

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Error getting lifecycle claim requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const {
            effectCid,
            bondHoldingCid,
            bondRulesCid,
            bondInstrumentCid,
            currencyTransferFactoryCid,
            issuerCurrencyHoldingCid,
            holder,
            issuer,
            seed,
            disclosure,
        } = await request.json();

        if (
            !effectCid ||
            !bondHoldingCid ||
            !bondRulesCid ||
            !bondInstrumentCid ||
            !currencyTransferFactoryCid ||
            !issuerCurrencyHoldingCid ||
            !holder ||
            !issuer ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            holder,
            keyPair
        );

        await wrappedSdk.bonds.lifecycleClaimRequest.create(
            {
                effectCid,
                bondHoldingCid,
                bondRulesCid,
                bondInstrumentCid,
                currencyTransferFactoryCid,
                issuerCurrencyHoldingCid,
                holder,
                issuer,
            },
            disclosure ? [disclosure] : undefined
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating lifecycle claim request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
