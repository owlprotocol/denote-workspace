import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkForParty,
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const owner = searchParams.get("owner");

        if (!owner) {
            return NextResponse.json(
                { error: "Missing owner" },
                { status: 400 }
            );
        }

        const wrappedSdk = await getWrappedSdkForParty(owner);
        const compositionCids =
            await wrappedSdk.etf.portfolioComposition.getAll();

        const compositions = await Promise.all(
            compositionCids.map(async (cid) => {
                const details = await wrappedSdk.etf.portfolioComposition.get(
                    cid
                );
                return {
                    contractId: cid,
                    ...details,
                };
            })
        );

        return NextResponse.json({ compositions });
    } catch (error) {
        console.error("Error getting portfolio compositions:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { owner, name, items, seed } = await request.json();

        if (!owner || !name || !items || !seed) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "Items must be a non-empty array" },
                { status: 400 }
            );
        }

        for (const item of items) {
            if (
                !item.instrumentId ||
                !item.instrumentId.admin ||
                !item.instrumentId.id ||
                typeof item.weight !== "number" ||
                item.weight <= 0
            ) {
                return NextResponse.json(
                    { error: "Invalid portfolio item structure" },
                    { status: 400 }
                );
            }
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            owner,
            keyPair
        );

        await wrappedSdk.etf.portfolioComposition.create({
            owner,
            name,
            items,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating portfolio composition:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
