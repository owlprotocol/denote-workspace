import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getSdkForParty,
    getWrappedSdk,
    issuerMintRequestTemplateId,
    ActiveContractResponse,
} from "@owlprotocol/token-sdk";

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
        const wrappedSdk = getWrappedSdk(sdk);

        const contractIds = await wrappedSdk.issuerMintRequest.getAll(issuer);

        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();
        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [issuerMintRequestTemplateId],
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
                    receiver: string;
                    amount: number;
                };

                return {
                    contractId,
                    tokenFactoryCid: createArg.tokenFactoryCid,
                    issuer: createArg.issuer,
                    receiver: createArg.receiver,
                    amount: createArg.amount,
                };
            })
            .filter((req): req is NonNullable<typeof req> => req !== null);

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Error getting mint requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { tokenFactoryCid, issuer, receiver, amount, seed } =
            await request.json();

        if (!tokenFactoryCid || !issuer || !receiver || !amount || !seed) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            receiver,
            keyPair
        );

        await wrappedSdk.issuerMintRequest.create({
            tokenFactoryCid,
            issuer,
            receiver,
            amount,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating mint request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
