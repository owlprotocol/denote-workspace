import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";
import { InstrumentId } from "../types/InstrumentId.js";
import { transferRequestTemplateId } from "../constants/templateIds.js";

export type Metadata = Record<string, unknown>;

export type ChoiceContext = Record<string, unknown>;

export interface ExtraArgs {
    context: ChoiceContext;
    meta: Metadata;
}

export interface Transfer {
    sender: Party;
    receiver: Party;
    amount: number;
    instrumentId: InstrumentId;
    requestedAt: string; // ISO timestamp
    executeBefore: string; // ISO timestamp
    inputHoldingCids: ContractId[];
    meta: Metadata;
}

export interface TransferRequestParams {
    transferFactoryCid: ContractId;
    expectedAdmin: Party;
    transfer: Transfer;
    extraArgs: ExtraArgs;
}

const getCreateTransferRequestCommand = (params: TransferRequestParams) =>
    getCreateCommand({ templateId: transferRequestTemplateId, params });

// Create empty metadata/context helpers
// Based on Splice.Api.Token.MetadataV1 Daml definitions
export const emptyMetadata = (): Metadata => ({ values: {} });
export const emptyChoiceContext = (): ChoiceContext => ({ values: {} });
export const emptyExtraArgs = (): ExtraArgs => ({
    context: emptyChoiceContext(),
    meta: emptyMetadata(),
});

/**
 * Create a transfer request
 * @param senderLedger - The sender's ledger controller
 * @param senderKeyPair - The sender's key pair for signing
 * @param params - Transfer request parameters
 */
export async function createTransferRequest(
    senderLedger: LedgerController,
    senderKeyPair: UserKeyPair,
    params: TransferRequestParams
) {
    const createTransferRequestCommand =
        getCreateTransferRequestCommand(params);

    await senderLedger.prepareSignExecuteAndWaitFor(
        [createTransferRequestCommand],
        senderKeyPair.privateKey,
        v4()
    );
}

export async function getAllTransferRequests(
    userLedger: LedgerController,
    expectedAdmin: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [transferRequestTemplateId],
    })) as ActiveContractResponse<TransferRequestParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.transfer.sender === partyId &&
                createArgument.expectedAdmin === expectedAdmin) ||
            createArgument.expectedAdmin === partyId
        );
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

/**
 * Get the latest transfer request for a given sender and admin
 * @param senderLedger - The sender's ledger controller
 * @param expectedAdmin - The expected admin party
 */
export async function getLatestTransferRequest(
    senderLedger: LedgerController,
    expectedAdmin: Party
) {
    const sender = senderLedger.getPartyId();
    const end = await senderLedger.ledgerEnd();
    const activeContracts = (await senderLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [sender],
        templateIds: [transferRequestTemplateId],
    })) as ActiveContractResponse<TransferRequestParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.transfer.sender === sender &&
            createArgument.expectedAdmin === expectedAdmin
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

/**
 * Accept a transfer request (admin action)
 * Creates a MyTransferInstruction and locks the tokens
 * @param adminLedger - The admin's ledger controller
 * @param adminKeyPair - The admin's key pair for signing
 * @param contractId - The transfer request contract ID
 */
export async function acceptTransferRequest(
    adminLedger: LedgerController,
    adminKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: transferRequestTemplateId,
        contractId,
        choice: "Accept",
        params: {},
    });

    await adminLedger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        adminKeyPair.privateKey,
        v4()
    );
}

/**
 * Decline a transfer request (admin action)
 * @param adminLedger - The admin's ledger controller
 * @param adminKeyPair - The admin's key pair for signing
 * @param contractId - The transfer request contract ID
 */
export async function declineTransferRequest(
    adminLedger: LedgerController,
    adminKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: transferRequestTemplateId,
        contractId,
        choice: "Decline",
        params: {},
    });

    await adminLedger.prepareSignExecuteAndWaitFor(
        [declineCommand],
        adminKeyPair.privateKey,
        v4()
    );
}

/**
 * Withdraw a transfer request (sender action)
 * @param senderLedger - The sender's ledger controller
 * @param senderKeyPair - The sender's key pair for signing
 * @param contractId - The transfer request contract ID
 */
export async function withdrawTransferRequest(
    senderLedger: LedgerController,
    senderKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: transferRequestTemplateId,
        contractId,
        choice: "Withdraw",
        params: {},
    });

    await senderLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        senderKeyPair.privateKey,
        v4()
    );
}

/**
 * Helper to build a Transfer object with proper timestamp formatting
 */
export function buildTransfer(params: {
    sender: Party;
    receiver: Party;
    amount: number;
    instrumentId: InstrumentId;
    requestedAt: Date;
    executeBefore: Date;
    inputHoldingCids: ContractId[];
}): Transfer {
    return {
        sender: params.sender,
        receiver: params.receiver,
        amount: params.amount,
        instrumentId: params.instrumentId,
        requestedAt: params.requestedAt.toISOString(),
        executeBefore: params.executeBefore.toISOString(),
        inputHoldingCids: params.inputHoldingCids,
        meta: emptyMetadata(),
    };
}
