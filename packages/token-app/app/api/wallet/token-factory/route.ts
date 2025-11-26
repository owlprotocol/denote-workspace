import { NextRequest, NextResponse } from "next/server";
import {
    getSdkForParty,
    getWrappedSdkForParty,
    tokenFactoryTemplateId,
    ActiveContractResponse,
} from "@owlprotocol/token-sdk";

interface TokenFactoryParams {
    issuer: string;
    instrumentId: string;
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
            templateIds: [tokenFactoryTemplateId],
        })) as ActiveContractResponse<TokenFactoryParams>[];

        const instruments = activeContracts
            .map((contract) => {
                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument;
                const contractId = jsActive.createdEvent.contractId;

                const instrumentId = createArg.instrumentId;
                const nameMatch = instrumentId.match(/^[^#]+#(.+)$/);
                const name = nameMatch ? nameMatch[1] : instrumentId;

                return {
                    name,
                    instrumentId,
                    custodianPartyId,
                    tokenFactoryCid: contractId,
                };
            })
            .filter((inst): inst is NonNullable<typeof inst> => inst !== null);

        return NextResponse.json({ instruments });
    } catch (error) {
        console.error("Error getting token factory:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { custodianPartyId, name } = await request.json();

        if (!custodianPartyId || !name) {
            return NextResponse.json(
                { error: "Missing custodianPartyId or name" },
                { status: 400 }
            );
        }

        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            return NextResponse.json(
                {
                    error: "Instrument name must contain only alphanumeric characters and underscores",
                },
                { status: 400 }
            );
        }

        const instrumentId = `${custodianPartyId}#${name}`;

        const wrappedSdk = await getWrappedSdkForParty(custodianPartyId);
        const tokenFactoryCid = await wrappedSdk.tokenFactory.getLatest(
            instrumentId
        );

        if (tokenFactoryCid) {
            return NextResponse.json(
                { error: "Instrument with this name already exists" },
                { status: 409 }
            );
        }

        const newInstrument = {
            name,
            instrumentId,
            custodianPartyId,
        };

        return NextResponse.json(
            { instrument: newInstrument },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating instrument:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
