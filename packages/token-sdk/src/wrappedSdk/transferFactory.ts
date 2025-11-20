import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";

export interface TransferFactoryParams {
    registry: Party;
    rulesCid: ContractId;
}

export const transferFactoryTemplateId =
    "#minimal-token:MyTransferFactory:MyTransferFactory";

const getCreateTransferFactoryCommand = (params: TransferFactoryParams) =>
    getCreateCommand({ templateId: transferFactoryTemplateId, params });

// TODO: do not pass userKeyPair here
export async function createTransferFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    rulesCid: ContractId
) {
    const registry = userLedger.getPartyId();
    const createTransferFactoryCommand = getCreateTransferFactoryCommand({
        registry,
        rulesCid,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createTransferFactoryCommand],
        userKeyPair.privateKey,
        v4()
    );
}

// Assumes registry is also the party
export async function getLatestTransferFactory(
    userLedger: LedgerController,
    rulesCid: ContractId
) {
    const registry = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [registry],
        templateIds: [transferFactoryTemplateId],
    })) as ActiveContractResponse<TransferFactoryParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.registry === registry &&
            createArgument.rulesCid === rulesCid
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

export async function getOrCreateTransferFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    rulesCid: ContractId
) {
    const contractId = await getLatestTransferFactory(userLedger, rulesCid);
    if (contractId) return contractId;

    await createTransferFactory(userLedger, userKeyPair, rulesCid);
    return (await getLatestTransferFactory(userLedger, rulesCid))!;
}
