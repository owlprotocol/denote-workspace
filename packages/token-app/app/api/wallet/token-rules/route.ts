import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const admin = searchParams.get("admin");

        if (!admin) {
            return NextResponse.json(
                { error: "Missing admin" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(admin);
        const rulesCid = await wrappedSdk.tokenRules.getLatest();

        if (!rulesCid) {
            return NextResponse.json(
                { error: "Token rules not found for this admin" },
                { status: 404 }
            );
        }

        return NextResponse.json({ rulesCid });
    } catch (error) {
        console.error("Error getting token rules:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
