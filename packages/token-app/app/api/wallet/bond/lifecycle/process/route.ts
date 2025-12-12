import { NextRequest, NextResponse } from "next/server";
import {
    keyPairFromSeed,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";

export async function POST(request: NextRequest) {
    let eventType: string | undefined;
    let targetInstrumentId: string | undefined;
    let targetVersion: string | undefined;
    let bondCid: string | undefined;

    try {
        const {
            lifecycleRuleCid,
            eventType: eventTypeParam,
            targetInstrumentId: targetInstrumentIdParam,
            targetVersion: targetVersionParam,
            bondCid: bondCidParam,
            partyId,
            seed,
        } = await request.json();

        eventType = eventTypeParam;
        targetInstrumentId = targetInstrumentIdParam;
        targetVersion = targetVersionParam;
        bondCid = bondCidParam;

        if (
            !lifecycleRuleCid ||
            !eventTypeParam ||
            !targetInstrumentIdParam ||
            !targetVersionParam ||
            !bondCidParam ||
            !partyId ||
            !seed
        ) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 }
            );
        }

        if (eventTypeParam !== "coupon" && eventTypeParam !== "redemption") {
            return NextResponse.json(
                { error: "Event type must be 'coupon' or 'redemption'" },
                { status: 400 }
            );
        }

        const keyPair = keyPairFromSeed(seed);
        const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
            partyId,
            keyPair
        );

        if (eventTypeParam === "coupon") {
            await wrappedSdk.bonds.lifecycleRule.processCouponPaymentEvent(
                lifecycleRuleCid,
                {
                    targetInstrumentId: targetInstrumentIdParam,
                    targetVersion: targetVersionParam,
                    bondCid: bondCidParam,
                }
            );
        } else {
            await wrappedSdk.bonds.lifecycleRule.processRedemptionEvent(
                lifecycleRuleCid,
                {
                    targetInstrumentId: targetInstrumentIdParam,
                    targetVersion: targetVersionParam,
                    bondCid: bondCidParam,
                }
            );
        }

        const effect = await wrappedSdk.bonds.lifecycleEffect.getLatest(
            partyId
        );

        return NextResponse.json({
            effectCid: effect.contractId,
            producedVersion: effect.producedVersion,
        });
    } catch (error) {
        console.error("Error processing lifecycle event:", error);
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        console.error("Full error details:", {
            errorMessage,
            eventType,
            targetInstrumentId,
            targetVersion,
            bondCid,
        });
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
