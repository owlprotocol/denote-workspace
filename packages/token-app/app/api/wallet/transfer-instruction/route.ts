import { NextRequest, NextResponse } from "next/server";
import {
    getSdkForParty,
    tokenTransferInstructionTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");

        if (!partyId) {
            return NextResponse.json(
                { error: "Missing partyId" },
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
            templateIds: [tokenTransferInstructionTemplateId],
        })) as ActiveContractResponse[];

        const instructions = activeContracts
            .map((contract) => {
                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument as {
                    transfer: {
                        sender: string;
                        receiver: string;
                        amount: number;
                        instrumentId: { admin: string; id: string };
                    };
                    lockedMyToken: string;
                };
                const contractId = jsActive.createdEvent.contractId;

                if (createArg.transfer?.receiver !== partyId) {
                    return null;
                }

                return {
                    contractId,
                    transfer: {
                        sender: createArg.transfer.sender,
                        receiver: createArg.transfer.receiver,
                        amount: createArg.transfer.amount,
                        instrumentId: createArg.transfer.instrumentId,
                    },
                };
            })
            .filter((inst): inst is NonNullable<typeof inst> => inst !== null);

        return NextResponse.json({ instructions });
    } catch (error) {
        console.error("Error getting transfer instructions:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
