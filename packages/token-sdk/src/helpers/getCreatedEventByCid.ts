import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId } from "../types/daml.js";
export async function getCreatedEventByCid<
    ContractParams = Record<string, unknown>
>(ledger: LedgerController, contractId: ContractId, templateId: string) {
    const activeParty = ledger.getPartyId();
    const end = await ledger.ledgerEnd();
    const activeContracts = (await ledger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [activeParty],
        templateIds: [templateId],
    })) as ActiveContractResponse<ContractParams>[];

    const contract = activeContracts.find(
        ({ contractEntry }) =>
            contractEntry.JsActiveContract?.createdEvent.contractId ===
            contractId
    );

    if (!contract?.contractEntry.JsActiveContract) {
        throw new Error(`Contract not found: ${contractId}`);
    }

    return contract.contractEntry.JsActiveContract.createdEvent;
}
