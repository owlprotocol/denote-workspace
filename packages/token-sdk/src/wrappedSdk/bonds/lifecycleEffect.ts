import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { bondLifecycleEffectTemplateId } from "../../constants/templateIds.js";

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
