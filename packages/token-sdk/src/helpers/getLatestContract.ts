import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractsEqual } from "../types/ContractsEqual.js";
import { ContractId } from "../types/daml.js";

export async function getLatestContract<
    ContractParams = Record<string, unknown>
>(
    ledger: LedgerController,
    templateId: string,
    contractParamsToCompare: ContractParams,
    contractsEqual: ContractsEqual<ContractParams>
): Promise<ContractId | undefined> {
    const activeParty = ledger.getPartyId();
    const end = await ledger.ledgerEnd();
    const activeContracts = (await ledger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [activeParty],
        templateIds: [templateId],
    })) as ActiveContractResponse<ContractParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return contractsEqual(createArgument, contractParamsToCompare);
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}
