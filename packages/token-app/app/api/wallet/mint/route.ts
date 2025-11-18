import { NextRequest, NextResponse } from "next/server";
import { getSDK } from "@/lib/wallet/sdk-instance";
import { keyPairFromSeed, mintToken } from "@owlprotocol/token-sdk";
import { logger } from "@/lib/wallet/sdk";

export async function POST(request: NextRequest) {
    try {
        const { tokenFactoryContractId, receiver, amount, seed } =
            await request.json();

        if (!tokenFactoryContractId || !receiver || !amount || !seed) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        const sdk = await getSDK();
        if (!sdk.userLedger) {
            return NextResponse.json(
                { error: "SDK not connected" },
                { status: 500 }
            );
        }

        await sdk.setPartyId(receiver);

        const keyPair = keyPairFromSeed(seed);
        await mintToken(sdk.userLedger, keyPair, {
            tokenFactoryContractId,
            receiver,
            amount,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, "Error minting token");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
