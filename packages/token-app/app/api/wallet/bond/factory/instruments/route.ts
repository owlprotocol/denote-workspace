import { NextRequest, NextResponse } from "next/server";
import {
    getSdkForParty,
    bondInstrumentTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

interface BondInstrumentParams {
    issuer: string;
    instrumentId: string;
    maturityDate: string;
    couponRate: number;
    couponFrequency: number;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const custodianPartyId = searchParams.get("custodianPartyId");

        if (!custodianPartyId) {
            return NextResponse.json(
                { error: "Missing custodianPartyId" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(custodianPartyId);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();

        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [custodianPartyId],
            templateIds: [bondInstrumentTemplateId],
        })) as ActiveContractResponse<BondInstrumentParams>[];

        const instruments = activeContracts
            .map((contract) => {
                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument;
                const contractId = jsActive.createdEvent.contractId;

                if (createArg.issuer !== custodianPartyId) return null;

                const instrumentId = createArg.instrumentId;
                const nameMatch = instrumentId.match(/^[^#]+#(.+)$/);
                const name = nameMatch ? nameMatch[1] : instrumentId;

                return {
                    name,
                    instrumentId,
                    custodianPartyId,
                    bondInstrumentCid: contractId,
                    maturityDate: createArg.maturityDate,
                    couponRate: createArg.couponRate,
                    couponFrequency: createArg.couponFrequency,
                };
            })
            .filter((inst): inst is NonNullable<typeof inst> => inst !== null);

        return NextResponse.json({ instruments });
    } catch (error) {
        console.error("Error getting bond instruments:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
