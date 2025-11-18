import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getDefaultSdkAndConnect,
    getWrappedSdkWithKeyPair,
} from "@owlprotocol/token-sdk";

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

        const keyPair = keyPairFromSeed(seed);
        const sdk = await getDefaultSdkAndConnect();
        await sdk.setPartyId(receiver);
        const wrappedSdk = getWrappedSdkWithKeyPair(sdk, keyPair);

        await wrappedSdk.tokenFactory.mintToken({
            tokenFactoryContractId,
            receiver,
            amount,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error minting token:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
