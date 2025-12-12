import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");

        if (!partyId) {
            return NextResponse.json(
                { error: "Missing partyId" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(partyId);

        try {
            const effects = await wrappedSdk.bonds.lifecycleEffect.getAll(
                partyId
            );
            return NextResponse.json(effects);
        } catch (error) {
            if (
                error instanceof Error &&
                error.message.includes("Bond lifecycle effect not found")
            ) {
                return NextResponse.json([], { status: 200 });
            }
            throw error;
        }
    } catch (error) {
        console.error("Error getting lifecycle effect:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
