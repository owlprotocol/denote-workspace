import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";

export interface IssuerBurnRequestParams {
    tokenFactoryCid: ContractId;
    issuer: Party;
    owner: Party;
    amount: number;
    inputHoldingCid: ContractId;
}

export const issuerBurnRequestTemplateId =
    "#minimal-token:MyToken.IssuerBurnRequest:IssuerBurnRequest";

const getCreateIssuerBurnRequestCommand = (params: IssuerBurnRequestParams) =>
    getCreateCommand({ templateId: issuerBurnRequestTemplateId, params });

export async function createIssuerBurnRequest(
    ownerLedger: LedgerController,
    ownerKeyPair: UserKeyPair,
    params: IssuerBurnRequestParams
) {
    const createBurnRequestCommand = getCreateIssuerBurnRequestCommand(params);

    await ownerLedger.prepareSignExecuteAndWaitFor(
        [createBurnRequestCommand],
        ownerKeyPair.privateKey,
        v4()
    );
}

export async function getAllIssuerBurnRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [issuerBurnRequestTemplateId],
    })) as ActiveContractResponse<IssuerBurnRequestParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.owner === partyId &&
                createArgument.issuer === issuer) ||
            createArgument.issuer === partyId
        );
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

// TODO: fix param types to be more specific
export async function getLatestIssuerBurnRequest(
    ownerLedger: LedgerController,
    issuer: Party
) {
    const owner = ownerLedger.getPartyId();
    const end = await ownerLedger.ledgerEnd();
    const activeContracts = (await ownerLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [owner],
        templateIds: [issuerBurnRequestTemplateId],
    })) as ActiveContractResponse<IssuerBurnRequestParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.owner === owner && createArgument.issuer === issuer
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

export async function acceptIssuerBurnRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: issuerBurnRequestTemplateId,
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

export async function declineIssuerBurnRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: issuerBurnRequestTemplateId,
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

export async function withdrawIssuerBurnRequest(
    ownerLedger: LedgerController,
    ownerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: issuerBurnRequestTemplateId,
        contractId,
        choice: "Withdraw",
        params: {},
    });

    await ownerLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        ownerKeyPair.privateKey,
        v4()
    );
}
