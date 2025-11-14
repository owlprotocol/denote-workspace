import { NextRequest, NextResponse } from "next/server";
import { getSDK } from "@/lib/wallet/sdk-instance";
import { keyPairFromSeed } from "@/lib/wallet/keypair";
import { signTransactionHash } from "@canton-network/wallet-sdk";
import { logger } from "@/lib/wallet/sdk";

export async function POST(request: NextRequest) {
    try {
        const { name } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "Missing name" },
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

        const keyPair = keyPairFromSeed(name);

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
        logger.error({ err: error }, "Error creating party");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
