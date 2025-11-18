import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getDefaultSdkAndConnect,
} from "@owlprotocol/token-sdk";
import { signTransactionHash } from "@canton-network/wallet-sdk";

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "Missing name" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(name);
        const sdk = await getDefaultSdkAndConnect();
        if (!sdk.userLedger) {
            return NextResponse.json(
                { error: "SDK not connected" },
                { status: 500 }
            );
        }

        const generatedParty = await sdk.userLedger.generateExternalParty(
            keyPair.publicKey,
            name
        );
        if (!generatedParty) {
            return NextResponse.json(
                { error: `Error creating ${name} party` },
                { status: 500 }
            );
        }

        const signedHash = signTransactionHash(
            generatedParty.multiHash,
            keyPair.privateKey
        );

        try {
            const allocatedParty = await sdk.userLedger.allocateExternalParty(
                signedHash,
                generatedParty
            );

            if (!allocatedParty) {
                return NextResponse.json(
                    { error: `Error allocating ${name} party` },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                partyId: generatedParty.partyId,
            });
        } catch (error) {
            if (
                error instanceof Error &&
                (error.message.includes("already exists") ||
                    error.message.includes("ALREADY_EXISTS"))
            ) {
                return NextResponse.json({
                    partyId: generatedParty.partyId,
                });
            }
            throw error;
        }
    } catch (error) {
        console.error("Error creating party:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
