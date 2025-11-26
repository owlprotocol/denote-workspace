import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";

export interface IssuerMintRequestParams {
    tokenFactoryCid: ContractId;
    issuer: Party;
    receiver: Party;
    amount: number;
}

export const issuerMintRequestTemplateId =
    "#minimal-token:MyToken.IssuerMintRequest:IssuerMintRequest";

const getCreateIssuerMintRequestCommand = (params: IssuerMintRequestParams) =>
    getCreateCommand({ templateId: issuerMintRequestTemplateId, params });

/**
 * Create an issuer mint request (receiver proposes to receive minted tokens)
 * This is part of the two-step minting pattern:
 * 1. Receiver creates IssuerMintRequest
 * 2. Issuer accepts the request to mint tokens
 *
 * @param receiverLedger - The receiver's ledger controller
 * @param receiverKeyPair - The receiver's key pair for signing
 * @param params - Mint request parameters
 */
export async function createIssuerMintRequest(
    receiverLedger: LedgerController,
    receiverKeyPair: UserKeyPair,
    params: IssuerMintRequestParams
) {
    const createMintRequestCommand = getCreateIssuerMintRequestCommand(params);

    await receiverLedger.prepareSignExecuteAndWaitFor(
        [createMintRequestCommand],
        receiverKeyPair.privateKey,
        v4()
    );
}

export async function getAllIssuerMintRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [issuerMintRequestTemplateId],
    })) as ActiveContractResponse<IssuerMintRequestParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.receiver === partyId &&
                createArgument.issuer === issuer) ||
            createArgument.issuer === partyId
        );
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

/**
 * Get the latest mint request for a given receiver and issuer
 * @param receiverLedger - The receiver's ledger controller
 * @param issuer - The issuer party
 */
export async function getLatestIssuerMintRequest(
    receiverLedger: LedgerController,
    issuer: Party
) {
    const receiver = receiverLedger.getPartyId();
    const end = await receiverLedger.ledgerEnd();
    const activeContracts = (await receiverLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [receiver],
        templateIds: [issuerMintRequestTemplateId],
    })) as ActiveContractResponse<IssuerMintRequestParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.receiver === receiver &&
            createArgument.issuer === issuer
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

/**
 * Accept an issuer mint request (issuer action)
 * Mints tokens to the receiver
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function acceptIssuerMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: issuerMintRequestTemplateId,
        contractId,
        choice: "Accept",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Decline an issuer mint request (issuer action)
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function declineIssuerMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: issuerMintRequestTemplateId,
        contractId,
        choice: "Decline",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [declineCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Withdraw an issuer mint request (issuer action - note: controller is issuer in the Daml template)
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function withdrawIssuerMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: issuerMintRequestTemplateId,
        contractId,
        choice: "Withdraw",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}
