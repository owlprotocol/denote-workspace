import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const admin = searchParams.get("admin");
        const id = searchParams.get("id");
        const partyId = searchParams.get("partyId");

        if (!admin || !id || !partyId) {
            return NextResponse.json(
                { error: "Missing admin, id, or partyId" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(partyId);

        const balances = await wrappedSdk.balances.getAllByInstrumentId({
            instrumentId: { admin, id },
        });

        return NextResponse.json({ balances });
    } catch (error) {
        console.error("Error getting all balances by instrument ID:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
