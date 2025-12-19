import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const contractId = searchParams.get("contractId");

        if (!partyId || !contractId) {
            return NextResponse.json(
                { error: "Missing partyId or contractId" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(partyId);
        const bond = await wrappedSdk.bonds.bond.get(contractId);

        if (!bond) {
            return NextResponse.json(
                { error: "Bond contract not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ version: bond.version });
    } catch (error) {
        console.error("Error getting bond version:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
