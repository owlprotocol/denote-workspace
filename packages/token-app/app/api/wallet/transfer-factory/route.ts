import { NextRequest, NextResponse } from "next/server";
import { getWrappedSdkForParty } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const admin = searchParams.get("admin");
        const rulesCid = searchParams.get("rulesCid");

        if (!admin || !rulesCid) {
            return NextResponse.json(
                { error: "Missing admin or rulesCid" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(admin);
        const transferFactoryCid = await wrappedSdk.transferFactory.getLatest(
            rulesCid
        );

        if (!transferFactoryCid) {
            return NextResponse.json(
                { error: "Transfer factory not found for this rules CID" },
                { status: 404 }
            );
        }

        return NextResponse.json({ transferFactoryCid });
    } catch (error) {
        console.error("Error getting transfer factory:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
