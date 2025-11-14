import { NextRequest, NextResponse } from "next/server";
import { getSDK } from "@/lib/wallet/sdk-instance";
import { getBalanceByInstrumentId } from "@owlprotocol/token-sdk";
import { logger } from "@/lib/wallet/sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const owner = searchParams.get("owner");
        const admin = searchParams.get("admin");
        const id = searchParams.get("id");

        if (!owner || !admin || !id) {
            return NextResponse.json(
                { error: "Missing owner, admin, or id" },
                { status: 400 }
            );
        }

        const sdk = await getSDK();

        await sdk.setPartyId(owner);

        const balance = await getBalanceByInstrumentId(sdk, {
            owner,
            instrumentId: { admin, id },
        });

        return NextResponse.json(balance);
    } catch (error) {
        logger.error({ err: error }, "Error getting balance");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
