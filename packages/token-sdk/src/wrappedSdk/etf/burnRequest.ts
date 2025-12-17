import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { etfBurnRequestTemplateId } from "../../constants/templateIds.js";

export interface EtfBurnRequestParams {
    mintRecipeCid: ContractId;
    requester: Party;
    amount: number;
    tokenFactoryCid: ContractId;
    inputHoldingCid: ContractId;
    issuer: Party;
}

const getCreateEtfBurnRequestCommand = (params: EtfBurnRequestParams) =>
    getCreateCommand({ templateId: etfBurnRequestTemplateId, params });

/**
 * Create an ETF burn request (requester proposes to burn ETF tokens)
 * This is part of the ETF burning pattern:
 * 1. Requester creates ETF burn request with their ETF token holding
 * 2. Issuer accepts the request with transfer instructions for underlying assets
 *
 * @param requesterLedger - The requester's ledger controller
 * @param requesterKeyPair - The requester's key pair for signing
 * @param params - ETF burn request parameters
 */
export async function createEtfBurnRequest(
    requesterLedger: LedgerController,
    requesterKeyPair: UserKeyPair,
    params: EtfBurnRequestParams
) {
    const createBurnRequestCommand = getCreateEtfBurnRequestCommand(params);

    await requesterLedger.prepareSignExecuteAndWaitFor(
        [createBurnRequestCommand],
        requesterKeyPair.privateKey,
        v4()
    );
}

/**
 * Get all ETF burn requests for a given issuer
 * @param userLedger - The user's ledger controller
 * @param issuer - The issuer party
 */
export async function getAllEtfBurnRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [etfBurnRequestTemplateId],
    })) as ActiveContractResponse<EtfBurnRequestParams>[];

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
 * Get the latest ETF burn request for a given issuer
 * @param userLedger - The user's ledger controller (can be requester or issuer)
 * @param issuer - The issuer party
 */
export async function getLatestEtfBurnRequest(
    userLedger: LedgerController,
    issuer: Party
): Promise<ContractId | undefined> {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [etfBurnRequestTemplateId],
    })) as ActiveContractResponse<EtfBurnRequestParams>[];

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
 * Accept an ETF burn request (issuer action)
 * Validates transfer instructions, executes them, and burns ETF tokens
 *
 * CRITICAL: Unlike ETF mint accept, this function REQUIRES transferInstructionCids parameter.
 * The issuer must provide transfer instructions for returning underlying assets to the requester.
 *
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The burn request contract ID
 * @param transferInstructionCids - Array of transfer instruction CIDs for returning underlying assets (REQUIRED)
 */
export async function acceptEtfBurnRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId,
    transferInstructionCids: ContractId[]
) {
    const acceptCommand = getExerciseCommand({
        templateId: etfBurnRequestTemplateId,
        contractId,
        choice: "BurnRequest_Accept",
        params: {
            transferInstructionCids: transferInstructionCids,
        },
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Decline an ETF burn request (issuer action)
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The burn request contract ID
 */
export async function declineEtfBurnRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: etfBurnRequestTemplateId,
        contractId,
        choice: "BurnRequest_Decline",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [declineCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Withdraw an ETF burn request (requester action)
 * @param requesterLedger - The requester's ledger controller
 * @param requesterKeyPair - The requester's key pair for signing
 * @param contractId - The burn request contract ID
 */
export async function withdrawEtfBurnRequest(
    requesterLedger: LedgerController,
    requesterKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: etfBurnRequestTemplateId,
        contractId,
        choice: "BurnRequest_Withdraw",
        params: {},
    });

    await requesterLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        requesterKeyPair.privateKey,
        v4()
    );
}
