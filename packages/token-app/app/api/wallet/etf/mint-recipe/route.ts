import { NextRequest, NextResponse } from "next/server";
import {
    getWrappedSdkForParty,
    getWrappedSdkWithKeyPairForParty,
    keyPairFromSeed,
    getSdkForParty,
    mintRecipeTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

interface MintRecipeParams {
    issuer: string;
    instrumentId: string;
    authorizedMinters: string[];
    composition: string;
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const issuer = searchParams.get("issuer");

        if (!issuer) {
            return NextResponse.json(
                { error: "Missing issuer" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(issuer);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();

        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [issuer],
            templateIds: [mintRecipeTemplateId],
        })) as ActiveContractResponse<MintRecipeParams>[];

        const recipes = activeContracts.map((contract) => {
            const jsActive = contract.contractEntry.JsActiveContract;
            if (!jsActive) return null;

            const createArg = jsActive.createdEvent.createArgument;
            const contractId = jsActive.createdEvent.contractId;

            return {
                contractId,
                issuer: createArg.issuer,
                instrumentId: createArg.instrumentId,
                authorizedMinters: createArg.authorizedMinters,
                composition: createArg.composition,
            };
        });

        const validRecipes = recipes.filter((recipe) => recipe !== null);

        return NextResponse.json({ recipes: validRecipes });
    } catch (error) {
        console.error("Error getting mint recipes:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { issuer, instrumentId, authorizedMinters, composition, seed } =
            await request.json();

        if (
            !issuer ||
            !instrumentId ||
            !authorizedMinters ||
            !composition ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required parameters" },
                { status: 400 }
            );
        }

        if (
            !Array.isArray(authorizedMinters) ||
            authorizedMinters.length === 0
        ) {
            return NextResponse.json(
                { error: "authorizedMinters must be a non-empty array" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            issuer,
            keyPair
        );

        await wrappedSdk.etf.mintRecipe.create({
            issuer,
            instrumentId,
            authorizedMinters,
            composition,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating mint recipe:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
