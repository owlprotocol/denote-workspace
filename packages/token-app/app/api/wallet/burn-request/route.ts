import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getWrappedSdkForParty,
    getSdkForParty,
    issuerBurnRequestTemplateId,
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

        const wrappedSdk = await getWrappedSdkForParty(partyId);

        const contractIds = await wrappedSdk.issuerBurnRequest.getAll(issuer);

        const sdk = await getSdkForParty(partyId);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();
        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [issuerBurnRequestTemplateId],
        })) as ActiveContractResponse[];

        const requests = contractIds
            .map((contractId: string) => {
                const contract = activeContracts.find(
                    (c) =>
                        c.contractEntry.JsActiveContract?.createdEvent
                            .contractId === contractId
                );
                if (!contract?.contractEntry.JsActiveContract) {
                    return null;
                }

                const jsActive = contract.contractEntry.JsActiveContract;
                const createArg = jsActive.createdEvent.createArgument as {
                    tokenFactoryCid: string;
                    issuer: string;
                    owner: string;
                    amount: number;
                    inputHoldingCid: string;
                };

                return {
                    contractId,
                    tokenFactoryCid: createArg.tokenFactoryCid,
                    issuer: createArg.issuer,
                    owner: createArg.owner,
                    amount: createArg.amount,
                    inputHoldingCid: createArg.inputHoldingCid,
                };
            })
            .filter((req): req is NonNullable<typeof req> => req !== null);

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Error getting burn requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const {
            tokenFactoryCid,
            issuer,
            owner,
            amount,
            inputHoldingCid,
            seed,
        } = await request.json();

        if (
            !tokenFactoryCid ||
            !issuer ||
            !owner ||
            !amount ||
            !inputHoldingCid ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            owner,
            keyPair
        );

        await wrappedSdk.issuerBurnRequest.create({
            tokenFactoryCid,
            issuer,
            owner,
            amount,
            inputHoldingCid,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating burn request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
