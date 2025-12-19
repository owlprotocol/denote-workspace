import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { bondLifecycleEffectTemplateId } from "../../constants/templateIds.js";
import { InstrumentId } from "../../types/InstrumentId.js";
import { WithContractId } from "../../types/WithContractId.js";

export type LifecycleEventType = "CouponPayment" | "Redemption";

export interface BondLifecycleEffectParams {
    issuer: Party;
    depository: Party;
    eventType: LifecycleEventType;
    targetInstrumentId: string;
    targetVersion: string;
    producedVersion?: string;
    eventDate: number;
    settlementTime?: number;
    amount: number;
    currencyInstrumentId: InstrumentId;
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
): Promise<WithContractId<BondLifecycleEffectParams>[]> {
    const end = await ledger.ledgerEnd();
    const activeContracts = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondLifecycleEffectTemplateId],
        filterByParty: true,
        parties: [party],
    })) as ActiveContractResponse<BondLifecycleEffectParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        return true;
        // TODO: consider filtering by issuer or other criteria
        // const { createArgument } = jsActive.createdEvent;
    });

    return filteredEntries.map((contract) => {
        const bondLifecycleEffect =
            contract.contractEntry.JsActiveContract!.createdEvent
                .createArgument;

        return {
            ...bondLifecycleEffect,
            contractId:
                contract.contractEntry.JsActiveContract!.createdEvent
                    .contractId,
        };
    });
}
