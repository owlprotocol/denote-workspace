import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getSdkForParty,
    getWrappedSdk,
    buildTransfer,
    emptyExtraArgs,
    transferRequestTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

/**
 * GET /api/wallet/transfer-request
 * Get all transfer requests for a party
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const expectedAdmin = searchParams.get("expectedAdmin");

        if (!partyId || !expectedAdmin) {
            return NextResponse.json(
                { error: "Missing partyId or expectedAdmin" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(partyId);
        const wrappedSdk = getWrappedSdk(sdk);

        const contractIds = await wrappedSdk.transferRequest.getAll(
            expectedAdmin
        );

        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();
        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [transferRequestTemplateId],
        })) as ActiveContractResponse[];

        const requests = contractIds
            .map((contractId: string) => {
                const contract = activeContracts.find(
                    (c) =>
                        c.contractEntry.JsActiveContract?.createdEvent
                            .contractId === contractId
                );
                if (!contract) return null;

                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument as {
                    transfer: {
                        sender: string;
                        receiver: string;
                        amount: number;
                        instrumentId: { admin: string; id: string };
                        requestedAt: string;
                        executeBefore: string;
                        inputHoldingCids: string[];
                    };
                    expectedAdmin: string;
                    transferFactoryCid: string;
                };

                return {
                    contractId,
                    transferFactoryCid: createArg.transferFactoryCid,
                    expectedAdmin: createArg.expectedAdmin,
                    transfer: createArg.transfer,
                };
            })
            .filter((req): req is NonNullable<typeof req> => req !== null);

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Error getting transfer requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const {
            transferFactoryCid,
            expectedAdmin,
            sender,
            receiver,
            amount,
            instrumentId,
            inputHoldingCids,
            seed,
        } = await request.json();

        if (
            !transferFactoryCid ||
            !expectedAdmin ||
            !sender ||
            !receiver ||
            !amount ||
            !instrumentId ||
            !inputHoldingCids ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            sender,
            keyPair
        );

        const now = new Date();
        const transfer = buildTransfer({
            sender,
            receiver,
            amount,
            instrumentId,
            requestedAt: new Date(now.getTime() - 1000),
            executeBefore: new Date(now.getTime() + 3600000),
            inputHoldingCids,
        });

        await wrappedSdk.transferRequest.create({
            transferFactoryCid,
            expectedAdmin,
            transfer,
            extraArgs: emptyExtraArgs(),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating transfer request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
