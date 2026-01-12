import { NextRequest, NextResponse } from "next/server";
import { getCreateTokenFactoryCommand } from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const issuer = searchParams.get("issuer");
        const instrumentId = searchParams.get("instrumentId");

        if (!issuer || !instrumentId) {
            return NextResponse.json(
                { error: "Missing issuer or instrumentId" },
                { status: 400 }
            );
        }

        const createTokenFactoryCommand = getCreateTokenFactoryCommand({
            issuer,
            instrumentId,
        });

        return NextResponse.json({ command: createTokenFactoryCommand });
    } catch (error) {
        console.error("Error creating token factory command:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
