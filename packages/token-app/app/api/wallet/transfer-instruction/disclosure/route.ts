import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const transferInstructionCid = searchParams.get(
            "transferInstructionCid"
        );
        const adminPartyId = searchParams.get("adminPartyId");

        if (!transferInstructionCid || !adminPartyId) {
            return NextResponse.json(
                {
                    error: "Missing transferInstructionCid or adminPartyId",
                },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(adminPartyId);
        const disclosure = await wrappedSdk.transferInstruction.getDisclosure(
            transferInstructionCid
        );

        return NextResponse.json({
            disclosure: disclosure.lockedTokenDisclosure,
        });
    } catch (error) {
        console.error("Error getting disclosure:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
