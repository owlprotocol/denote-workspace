import { NextResponse } from "next/server";
import { getDefaultSdkAndConnect } from "@owlprotocol/token-sdk";

export async function GET() {
    try {
        const sdk = await getDefaultSdkAndConnect();

        const isConnected = !!(sdk.userLedger && sdk.topology);

        return NextResponse.json({
            connected: isConnected,
            hasUserLedger: !!sdk.userLedger,
            hasAdminLedger: !!sdk.adminLedger,
            hasTopology: !!sdk.topology,
        });
    } catch (error) {
        console.error("Error checking connection status:", error);
        return NextResponse.json(
            {
                connected: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
