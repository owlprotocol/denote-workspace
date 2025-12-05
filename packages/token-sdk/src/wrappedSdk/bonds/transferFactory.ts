import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { bondTransferFactoryTemplateId } from "../../constants/templateIds.js";

export interface BondTransferFactoryParams {
    registry: Party;
    rulesCid: ContractId;
}

export async function createBondTransferFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    rulesCid: ContractId
) {
    const registry = userLedger.getPartyId();
    const createBondTransferFactoryCommand = getCreateCommand({
        templateId: bondTransferFactoryTemplateId,
        params: {
            registry,
            rulesCid,
        },
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createBondTransferFactoryCommand],
        userKeyPair.privateKey,
        v4()
    );
}

export async function getLatestBondTransferFactory(
    userLedger: LedgerController,
    rulesCid: ContractId
) {
    const registry = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [registry],
        templateIds: [bondTransferFactoryTemplateId],
    })) as ActiveContractResponse<BondTransferFactoryParams>[];

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

export async function getOrCreateBondTransferFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    rulesCid: ContractId
) {
    const contractId = await getLatestBondTransferFactory(userLedger, rulesCid);
    if (contractId) return contractId;

    await createBondTransferFactory(userLedger, userKeyPair, rulesCid);
    return (await getLatestBondTransferFactory(userLedger, rulesCid))!;
}
