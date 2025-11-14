import { NextResponse } from "next/server";
import { getSDK } from "@/lib/wallet/sdk-instance";
import { logger } from "@/lib/wallet/sdk";

export async function GET() {
    try {
        const sdk = await getSDK();

        const isConnected = !!(
            sdk.userLedger &&
            sdk.adminLedger &&
            sdk.topology
        );

        return NextResponse.json({
            connected: isConnected,
            hasUserLedger: !!sdk.userLedger,
            hasAdminLedger: !!sdk.adminLedger,
            hasTopology: !!sdk.topology,
        });
    } catch (error) {
        logger.error({ err: error }, "Error checking connection status");
        return NextResponse.json(
            {
                connected: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
