import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { Party } from "../../types/daml.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { bondRulesTemplateId } from "../../constants/templateIds.js";

export interface BondRulesParams {
    issuer: Party;
}

const getCreateBondRulesCommand = (params: BondRulesParams) =>
    getCreateCommand({ templateId: bondRulesTemplateId, params });

export async function createBondRules(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair
) {
    const issuer = userLedger.getPartyId();
    const createBondRulesCommand = getCreateBondRulesCommand({
        issuer,
    });

    const result = await userLedger.prepareSignExecuteAndWaitFor(
        [createBondRulesCommand],
        userKeyPair.privateKey,
        v4()
    );

    const contracts = (await userLedger.activeContracts({
        filterByParty: true,
        parties: [issuer],
        offset: result.offset,
    })) as ActiveContractResponse<BondRulesParams>[];

    const createdContract = contracts.filter(
        ({ contractEntry }) =>
            contractEntry.JsActiveContract?.createdEvent.offset ===
            result.offset
    );

    if (createdContract.length > 1) {
        throw new Error("Multiple BondRules contracts created unexpectedly");
    } else if (!createdContract[0]?.contractEntry.JsActiveContract) {
        throw new Error("Created BondRules contract not found");
    }

    return createdContract[0].contractEntry.JsActiveContract.createdEvent
        .contractId;
}

export async function getLatestBondRules(userLedger: LedgerController) {
    const issuer = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [bondRulesTemplateId],
    })) as ActiveContractResponse<BondRulesParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return createArgument.issuer === issuer;
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

export async function getOrCreateBondRules(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair
) {
    const contractId = await getLatestBondRules(userLedger);
    if (contractId) return contractId;

    return await createBondRules(userLedger, userKeyPair);
}
