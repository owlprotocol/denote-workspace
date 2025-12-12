import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { bondLifecycleEffectTemplateId } from "../../constants/templateIds.js";

export interface BondLifecycleEffectParams {
    producedVersion: string | null;
    eventType: "CouponPayment" | "Redemption";
    targetInstrumentId: string;
    targetVersion: string;
    eventDate: string;
    amount: number;
}

export interface BondLifecycleEffect {
    contractId: ContractId;
    producedVersion: string | null;
    eventType: "CouponPayment" | "Redemption";
    targetInstrumentId: string;
    targetVersion: string;
    eventDate: string;
    amount: number;
}

export async function getLatestBondLifecycleEffect(
    ledger: LedgerController,
    party: Party
): Promise<{ contractId: ContractId; producedVersion: string | null }> {
    const end = await ledger.ledgerEnd();
    const effects = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondLifecycleEffectTemplateId],
        filterByParty: true,
        parties: [party],
    })) as ActiveContractResponse[];

    if (effects.length === 0) {
        throw new Error("Bond lifecycle effect not found");
    }

    const effect =
        effects[effects.length - 1].contractEntry.JsActiveContract
            ?.createdEvent;
    if (!effect) {
        throw new Error("Bond lifecycle effect not found");
    }

    const params = effect.createArgument as {
        producedVersion: string | null;
    };

    return {
        contractId: effect.contractId,
        producedVersion: params.producedVersion,
    };
}

export async function getAllBondLifecycleEffects(
    ledger: LedgerController,
    party: Party
): Promise<BondLifecycleEffect[]> {
    const end = await ledger.ledgerEnd();
    const effects = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondLifecycleEffectTemplateId],
        filterByParty: true,
        parties: [party],
    })) as ActiveContractResponse<BondLifecycleEffectParams>[];

    return effects
        .map((contract) => {
            const jsActive = contract.contractEntry.JsActiveContract;
            if (!jsActive) return null;

            const createArg = jsActive.createdEvent.createArgument;
            const contractId = jsActive.createdEvent.contractId;

            return {
                contractId,
                producedVersion: createArg.producedVersion,
                eventType: createArg.eventType,
                targetInstrumentId: createArg.targetInstrumentId,
                targetVersion: createArg.targetVersion,
                eventDate: createArg.eventDate,
                amount: createArg.amount,
            };
        })
        .filter(
            (effect): effect is NonNullable<typeof effect> => effect !== null
        );
}
