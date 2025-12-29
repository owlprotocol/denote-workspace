import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkForParty,
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
    getSdkForParty,
    etfMintRequestTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

interface EtfMintRequestParams {
    mintRecipeCid: string;
    requester: string;
    amount: number;
    transferInstructionCids: string[];
    issuer: string;
}

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
        const contractIds = await wrappedSdk.etf.mintRequest.getAll(issuer);

        const sdk = await getSdkForParty(partyId);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();

        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [etfMintRequestTemplateId],
        })) as ActiveContractResponse<EtfMintRequestParams>[];

        const requests = contractIds.map((contractId: string) => {
            const contract = activeContracts.find(
                (c) =>
                    c.contractEntry.JsActiveContract?.createdEvent
                        .contractId === contractId
            );
            if (!contract?.contractEntry.JsActiveContract) {
                return null;
            }

            const jsActive = contract.contractEntry.JsActiveContract;
            const createArg = jsActive.createdEvent.createArgument;

            return {
                contractId,
                mintRecipeCid: createArg.mintRecipeCid,
                requester: createArg.requester,
                amount: createArg.amount,
                transferInstructionCids: createArg.transferInstructionCids,
                issuer: createArg.issuer,
            };
        });

        const validRequests = requests.filter((req) => req !== null);

        return NextResponse.json({ requests: validRequests });
    } catch (error) {
        console.error("Error getting ETF mint requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const {
            mintRecipeCid,
            requester,
            amount,
            transferInstructionCids,
            issuer,
            seed,
        } = await request.json();

        if (
            !mintRecipeCid ||
            !requester ||
            !amount ||
            !transferInstructionCids ||
            !issuer ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        if (
            !Array.isArray(transferInstructionCids) ||
            transferInstructionCids.length === 0
        ) {
            return NextResponse.json(
                { error: "transferInstructionCids must be a non-empty array" },
                { status: 400 }
            );
        }

        if (typeof amount !== "number" || amount <= 0) {
            return NextResponse.json(
                { error: "amount must be a positive number" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            requester,
            keyPair
        );

        await wrappedSdk.etf.mintRequest.create({
            mintRecipeCid,
            requester,
            amount,
            transferInstructionCids,
            issuer,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating ETF mint request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
