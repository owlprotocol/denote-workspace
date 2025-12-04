import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { bondIssuerMintRequestTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";

export interface BondIssuerMintRequestParams {
    bondFactoryCid: ContractId;
    issuer: Party;
    depository: Party;
    receiver: Party;
    principal: number;
    maturityDate: string;
    couponRate: number;
    couponFrequency: number; // Int
}

const getCreateBondIssuerMintRequestCommand = (
    params: BondIssuerMintRequestParams
) => getCreateCommand({ templateId: bondIssuerMintRequestTemplateId, params });

/**
 * Create an issuer mint request (receiver proposes to receive minted bonds)
 * This is part of the two-step minting pattern:
 * 1. Receiver creates IssuerMintRequest
 * 2. Issuer accepts the request to mint bonds
 *
 * @param receiverLedger - The receiver's ledger controller
 * @param receiverKeyPair - The receiver's key pair for signing
 * @param params - Mint request parameters
 */
export async function createBondIssuerMintRequest(
    receiverLedger: LedgerController,
    receiverKeyPair: UserKeyPair,
    params: BondIssuerMintRequestParams
) {
    const createMintRequestCommand =
        getCreateBondIssuerMintRequestCommand(params);

    await receiverLedger.prepareSignExecuteAndWaitFor(
        [createMintRequestCommand],
        receiverKeyPair.privateKey,
        v4()
    );
}

// TODO: handle both issuer and receiver querying
export async function getAllBondIssuerMintRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [bondIssuerMintRequestTemplateId],
    })) as ActiveContractResponse<BondIssuerMintRequestParams>[];

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

// const bondIssuerMintRequestsEqual = (
//     a: BondIssuerMintRequestParams,
//     b: BondIssuerMintRequestParams
// ) =>
//     a.bondFactoryCid === b.bondFactoryCid &&
//     a.issuer === b.issuer &&
//     a.depositary === b.depositary &&
//     a.receiver === b.receiver &&
//     a.principal === b.principal &&
//     a.maturityDate === b.maturityDate &&
//     a.couponRate === b.couponRate &&
//     a.couponFrequency === b.couponFrequency;

const issuerReceiverEqual = (
    a: { issuer: Party; receiver: Party },
    b: { issuer: Party; receiver: Party }
) => a.issuer === b.issuer && a.receiver === b.receiver;

// TODO: decide if we just want to pass issuer as param
/**
 * Get the latest mint request for a given receiver and issuer
 * @param receiverLedger - The receiver's ledger controller
 */
export async function getLatestBondIssuerMintRequest(
    receiverLedger: LedgerController,
    issuer: Party
) {
    const receiver = receiverLedger.getPartyId();

    return getLatestContract(
        receiverLedger,
        bondIssuerMintRequestTemplateId,
        { issuer, receiver },
        issuerReceiverEqual
    );
}

/**
 * Accept an issuer mint request (issuer action)
 * Mints bonds to the receiver
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function acceptBondIssuerMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: bondIssuerMintRequestTemplateId,
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
export async function declineBondIssuerMintRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: bondIssuerMintRequestTemplateId,
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
 * Withdraw an receiver mint request
 * @param receiverLedger - The receiver's ledger controller
 * @param receiverKeyPair - The receiver's key pair for signing
 * @param contractId - The mint request contract ID
 */
export async function withdrawBondIssuerMintRequest(
    receiverLedger: LedgerController,
    receiverKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: bondIssuerMintRequestTemplateId,
        contractId,
        choice: "Withdraw",
        params: {},
    });

    await receiverLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        receiverKeyPair.privateKey,
        v4()
    );
}
