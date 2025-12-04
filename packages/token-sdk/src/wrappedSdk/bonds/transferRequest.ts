import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { bondTransferRequestTemplateId } from "../../constants/templateIds.js";
import { ExtraArgs, Transfer } from "../transferRequest.js";

export interface BondTransferRequestParams {
    transferFactoryCid: ContractId;
    expectedAdmin: Party;
    transfer: Transfer;
    extraArgs: ExtraArgs;
}

export async function createBondTransferRequest(
    senderLedger: LedgerController,
    senderKeyPair: UserKeyPair,
    params: BondTransferRequestParams
) {
    const createBondTransferRequestCommand = getCreateCommand({
        templateId: bondTransferRequestTemplateId,
        params,
    });
    await senderLedger.prepareSignExecuteAndWaitFor(
        [createBondTransferRequestCommand],
        senderKeyPair.privateKey,
        v4()
    );
}
export async function getAllBondTransferRequests(
    senderLedger: LedgerController,
    expectedAdmin: Party
) {
    const partyId = senderLedger.getPartyId();
    const end = await senderLedger.ledgerEnd();
    const activeContracts = (await senderLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [bondTransferRequestTemplateId],
    })) as ActiveContractResponse<BondTransferRequestParams>[];

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

export async function getLatestBondTransferRequest(
    senderLedger: LedgerController,
    expectedAdmin: Party
) {
    const sender = senderLedger.getPartyId();
    const end = await senderLedger.ledgerEnd();
    const activeContracts = (await senderLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [sender],
        templateIds: [bondTransferRequestTemplateId],
    })) as ActiveContractResponse<BondTransferRequestParams>[];

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

export async function acceptBondTransferRequest(
    adminLedger: LedgerController,
    adminKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: bondTransferRequestTemplateId,
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

export async function declineBondTransferRequest(
    adminLedger: LedgerController,
    adminKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: bondTransferRequestTemplateId,
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

export async function withdrawBondTransferRequest(
    senderLedger: LedgerController,
    senderKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: bondTransferRequestTemplateId,
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
