import { NextRequest, NextResponse } from "next/server";
import { getDefaultSdkAndConnect, getWrappedSdk } from "@owlprotocol/token-sdk";

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

        const sdk = await getDefaultSdkAndConnect();
        await sdk.setPartyId(owner);
        const wrappedSdk = getWrappedSdk(sdk);

        const balance = await wrappedSdk.balances.getByInstrumentId({
            owner,
            instrumentId: { admin, id },
        });

        return NextResponse.json(balance);
    } catch (error) {
        console.error("Error getting balance:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
