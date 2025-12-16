import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { etfMintRequestTemplateId } from "../../constants/templateIds.js";

export interface EtfMintRequestParams {
    mintRecipeCid: ContractId;
    requester: Party;
    amount: number;
    transferInstructionCids: ContractId[];
    issuer: Party;
}

const getCreateEtfMintRequestCommand = (params: EtfMintRequestParams) =>
    getCreateCommand({ templateId: etfMintRequestTemplateId, params });

/**
 * Create an ETF mint request (requester proposes to mint ETF tokens)
 * This is part of the ETF minting pattern:
 * 1. Requester creates ETF mint request with transfer instructions for underlying assets
 * 2. Issuer accepts the request to validate transfers and mint ETF tokens
 *
 * @param requesterLedger - The requester's ledger controller
 * @param requesterKeyPair - The requester's key pair for signing
 * @param params - ETF mint request parameters
 */
export async function createEtfMintRequest(
    requesterLedger: LedgerController,
    requesterKeyPair: UserKeyPair,
    params: EtfMintRequestParams
) {
    const createMintRequestCommand = getCreateEtfMintRequestCommand(params);

    await requesterLedger.prepareSignExecuteAndWaitFor(
        [createMintRequestCommand],
        requesterKeyPair.privateKey,
        v4()
    );
}

/**
 * Get all ETF mint requests for a given issuer
 * @param userLedger - The user's ledger controller
 * @param issuer - The issuer party
 */
export async function getAllEtfMintRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [etfMintRequestTemplateId],
    })) as ActiveContractResponse<EtfMintRequestParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.requester === partyId &&
                createArgument.issuer === issuer) ||
            createArgument.issuer === partyId
        );
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

/**
 * Get the latest ETF mint request for a given issuer
 * @param userLedger - The user's ledger controller (can be requester or issuer)
 * @param issuer - The issuer party
 */
export async function getLatestEtfMintRequest(
    userLedger: LedgerController,
    issuer: Party
): Promise<ContractId | undefined> {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [etfMintRequestTemplateId],
    })) as ActiveContractResponse<EtfMintRequestParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.requester === partyId &&
                createArgument.issuer === issuer) ||
            createArgument.issuer === partyId
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }

    const contract = filteredEntries[filteredEntries.length - 1];
    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

/**
 * Accept an ETF mint request (issuer action)
 * Validates transfer instructions, executes them, and mints ETF tokens
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function acceptEtfMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: etfMintRequestTemplateId,
        contractId,
        choice: "MintRequest_Accept",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Decline an ETF mint request (issuer action)
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function declineEtfMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: etfMintRequestTemplateId,
        contractId,
        choice: "MintRequest_Decline",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [declineCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Withdraw an ETF mint request (requester action)
 * @param requesterLedger - The requester's ledger controller
 * @param requesterKeyPair - The requester's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function withdrawEtfMintRequest(
    requesterLedger: LedgerController,
    requesterKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: etfMintRequestTemplateId,
        contractId,
        choice: "MintRequest_Withdraw",
        params: {},
    });

    await requesterLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        requesterKeyPair.privateKey,
        v4()
    );
}
