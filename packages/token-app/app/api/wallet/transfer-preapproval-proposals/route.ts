import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getSdkForParty,
    getWrappedSdkWithKeyPairForParty,
    transferPreapprovalProposalTemplateId,
} from "@owlprotocol/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const type = searchParams.get("type");

        if (!partyId || !type) {
            return NextResponse.json(
                { error: "Missing partyId or type" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(partyId);
        const userLedger = sdk.userLedger!;

        const end = await userLedger.ledgerEnd();
        const activeContracts = await userLedger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [transferPreapprovalProposalTemplateId],
        });

        const proposals = activeContracts
            .map((contract: any) => {
                const jsActive = contract.contractEntry?.JsActiveContract;
                if (!jsActive) return null;
                const { createArgument, contractId } = jsActive.createdEvent;
                return {
                    contractId,
                    issuer: createArgument.issuer,
                    receiver: createArgument.receiver,
                    instrumentId: createArgument.instrumentId,
                };
            })
            .filter((p: any) => p !== null)
            .filter((p: any) => {
                if (type === "sent") {
                    return p.issuer === partyId;
                } else {
                    return p.receiver === partyId;
                }
            });

        return NextResponse.json({ proposals });
    } catch (error) {
        console.error("Error getting transfer preapproval proposals:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { receiver, instrumentId, seed, issuer } = await request.json();

        if (!receiver || !instrumentId || !seed || !issuer) {
            return NextResponse.json(
                { error: "Missing receiver, instrumentId, seed, or issuer" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            issuer,
            keyPair
        );

        const contractId =
            await wrappedSdk.transferPreapprovalProposal.getOrCreate({
                receiver,
                instrumentId,
            });

        return NextResponse.json({ contractId });
    } catch (error) {
        console.error("Error creating transfer preapproval proposal:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
