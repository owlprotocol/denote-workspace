import { LedgerController } from "@canton-network/wallet-sdk";
import { portfolioCompositionTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { v4 } from "uuid";

export interface PortfolioItem {
    instrumentId: {
        admin: Party;
        id: string;
    };
    weight: number;
}

export interface PortfolioCompositionParams {
    owner: Party;
    name: string;
    items: PortfolioItem[];
}

const getCreatePortfolioCompositionCommand = (
    params: PortfolioCompositionParams
) => getCreateCommand({ templateId: portfolioCompositionTemplateId, params });

/**
 * Create a portfolio composition
 * @param userLedger - The user's ledger controller
 * @param userKeyPair - The user's key pair for signing
 * @param params - Portfolio composition parameters
 */
export async function createPortfolioComposition(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: PortfolioCompositionParams
) {
    const createCommand = getCreatePortfolioCompositionCommand(params);

    await userLedger.prepareSignExecuteAndWaitFor(
        [createCommand],
        userKeyPair.privateKey,
        v4()
    );
}

/**
 * Get the latest portfolio composition for the current party
 * @param userLedger - The user's ledger controller
 * @param name - Optional name to filter by
 */
export async function getLatestPortfolioComposition(
    userLedger: LedgerController,
    name?: string
): Promise<ContractId | undefined> {
    const owner = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [owner],
        templateIds: [portfolioCompositionTemplateId],
    })) as ActiveContractResponse<PortfolioCompositionParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.owner === owner &&
            (!name || createArgument.name === name)
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }

    const contract = filteredEntries[filteredEntries.length - 1];
    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

/**
 * Get all portfolio compositions owned by the current party
 * @param userLedger - The user's ledger controller
 */
export async function getAllPortfolioCompositions(
    userLedger: LedgerController
): Promise<ContractId[]> {
    const owner = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [owner],
        templateIds: [portfolioCompositionTemplateId],
    })) as ActiveContractResponse<PortfolioCompositionParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return createArgument.owner === owner;
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

/**
 * Get a specific portfolio composition contract details
 * @param userLedger - The user's ledger controller
 * @param contractId - The portfolio composition contract ID
 */
export async function getPortfolioComposition(
    userLedger: LedgerController,
    contractId: ContractId
): Promise<PortfolioCompositionParams> {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [portfolioCompositionTemplateId],
    })) as ActiveContractResponse<PortfolioCompositionParams>[];

    const contract = activeContracts.find(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        return jsActive.createdEvent.contractId === contractId;
    });

    if (!contract) {
        throw new Error(`Portfolio composition ${contractId} not found`);
    }

    return contract.contractEntry.JsActiveContract!.createdEvent.createArgument;
}
