import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@owlprotocol/token-sdk";

export async function POST(request: NextRequest) {
    try {
        const { transferPreapprovalProposalContractId, seed, receiver } =
            await request.json();

        if (!transferPreapprovalProposalContractId || !seed || !receiver) {
            return NextResponse.json(
                {
                    error: "Missing transferPreapprovalProposalContractId, seed, or receiver",
                },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            receiver,
            keyPair
        );

        await wrappedSdk.transferPreapprovalProposal.accept({
            transferPreapprovalProposalContractId,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error accepting transfer preapproval proposal:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
