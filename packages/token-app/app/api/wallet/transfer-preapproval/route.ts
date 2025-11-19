import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getWrappedSdkForParty,
} from "@owlprotocol/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const issuer = searchParams.get("issuer");
        const receiver = searchParams.get("receiver");
        const instrumentId = searchParams.get("instrumentId");

        if (!issuer || !receiver || !instrumentId) {
            return NextResponse.json(
                { error: "Missing issuer, receiver, or instrumentId" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(issuer);

        const contractId = await wrappedSdk.transferPreapproval.getLatest({
            issuer,
            receiver,
            instrumentId,
        });

        return NextResponse.json({ contractId: contractId || null });
    } catch (error) {
        console.error("Error getting transfer preapproval:", error);
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
        const {
            transferPreapprovalContractId,
            tokenCid,
            sender,
            amount,
            seed,
        } = await request.json();

        if (
            !transferPreapprovalContractId ||
            !tokenCid ||
            !sender ||
            !amount ||
            !seed
        ) {
            return NextResponse.json(
                {
                    error: "Missing required parameters",
                },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            sender,
            keyPair
        );

        await wrappedSdk.transferPreapproval.send({
            transferPreapprovalContractId,
            tokenCid,
            sender,
            amount,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error sending transfer with preapproval:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
