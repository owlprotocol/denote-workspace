import { NextRequest, NextResponse } from "next/server";
import { etfSetup } from "@denotecapital/token-sdk";

export async function POST(_request: NextRequest) {
    try {
        const setupResult = await etfSetup();

        return NextResponse.json(setupResult);
    } catch (error) {
        console.error("Error running ETF setup:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
