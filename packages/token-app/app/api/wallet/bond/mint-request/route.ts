import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
    getSdkForParty,
    bondIssuerMintRequestTemplateId,
    ActiveContractResponse,
} from "@denotecapital/token-sdk";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const partyId = searchParams.get("partyId");
        const issuer = searchParams.get("issuer");

        if (!partyId || !issuer) {
            return NextResponse.json(
                { error: "Missing partyId or issuer" },
                { status: 400 }
            );
        }

        const sdk = await getSdkForParty(partyId);
        const ledger = sdk.userLedger!;
        const end = await ledger.ledgerEnd();

        const activeContracts = (await ledger.activeContracts({
            offset: end.offset,
            filterByParty: true,
            parties: [partyId],
            templateIds: [bondIssuerMintRequestTemplateId],
        })) as ActiveContractResponse[];

        const requests = activeContracts
            .map((contract) => {
                const jsActive = contract.contractEntry.JsActiveContract;
                if (!jsActive) return null;

                const createArg = jsActive.createdEvent.createArgument as {
                    instrumentCid: string;
                    issuer: string;
                    receiver: string;
                    amount: number;
                };
                const contractId = jsActive.createdEvent.contractId;

                // Filter by issuer if provided
                if (createArg.issuer !== issuer) return null;

                return {
                    contractId,
                    instrumentCid: createArg.instrumentCid,
                    issuer: createArg.issuer,
                    receiver: createArg.receiver,
                    amount: createArg.amount,
                };
            })
            .filter((req): req is NonNullable<typeof req> => req !== null);

        return NextResponse.json({ requests });
    } catch (error) {
        console.error("Error getting bond mint requests:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { instrumentCid, issuer, receiver, amount, seed } =
            await request.json();

        if (
            !instrumentCid ||
            !issuer ||
            !receiver ||
            amount === undefined ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            receiver,
            keyPair
        );

        await wrappedSdk.bonds.issuerMintRequest.create({
            instrumentCid,
            issuer,
            receiver,
            amount,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error creating bond mint request:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
