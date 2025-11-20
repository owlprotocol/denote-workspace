import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";

export interface TokenRulesParams {
    issuer: Party;
}

export const tokenRulesTemplateId = "#minimal-token:MyTokenRules:MyTokenRules";

const getCreateTokenRulesCommand = (params: TokenRulesParams) =>
    getCreateCommand({ templateId: tokenRulesTemplateId, params });

// TODO: do not pass userKeyPair here
export async function createTokenRules(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair
) {
    const issuer = userLedger.getPartyId();
    const createTokenRulesCommand = getCreateTokenRulesCommand({
        issuer,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createTokenRulesCommand],
        userKeyPair.privateKey,
        v4()
    );
}

// Assumes issuer is also the party
export async function getLatestTokenRules(userLedger: LedgerController) {
    const issuer = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [tokenRulesTemplateId],
    })) as ActiveContractResponse<TokenRulesParams>[];

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

export async function getOrCreateTokenRules(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair
) {
    const contractId = await getLatestTokenRules(userLedger);
    if (contractId) return contractId;

    await createTokenRules(userLedger, userKeyPair);
    return (await getLatestTokenRules(userLedger))!;
}
