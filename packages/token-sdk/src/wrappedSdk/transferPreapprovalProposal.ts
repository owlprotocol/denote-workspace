import { WrappedCommand, LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { TokenFactoryParams } from "./tokenFactory.js";
import { transferPreapprovalProposalTemplateId } from "../constants/templateIds.js";
import { ContractId, Party } from "../types/daml.js";

export type TransferPreapprovalProposalParams = TokenFactoryParams & {
    receiver: Party;
};

export const getCreateTransferPreapprovalProposalCommand = ({
    issuer,
    receiver,
    instrumentId,
}: {
    issuer: Party;
    receiver: Party;
    instrumentId: string;
}): WrappedCommand => ({
    CreateCommand: {
        templateId: transferPreapprovalProposalTemplateId,
        createArguments: {
            issuer,
            receiver,
            instrumentId,
        },
    },
});

export interface CreateTransferPreapprovalProposalParams {
    receiver: Party;
    instrumentId: string;
}
export async function createTransferPreapprovalProposal(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: {
        receiver: Party;
        instrumentId: string;
    }
) {
    const issuer = userLedger.getPartyId();
    const createTransferPreapprovalProposalCommand =
        getCreateTransferPreapprovalProposalCommand({ issuer, ...params });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createTransferPreapprovalProposalCommand],
        userKeyPair.privateKey,
        v4()
    );
}

export async function getLatestTransferPreapprovalProposal(
    userLedger: LedgerController,
    { issuer, instrumentId, receiver }: TransferPreapprovalProposalParams
) {
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [transferPreapprovalProposalTemplateId],
    })) as ActiveContractResponse<TransferPreapprovalProposalParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.instrumentId === instrumentId &&
            createArgument.issuer === issuer &&
            createArgument.receiver === receiver
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

export async function getOrCreateTransferPreapprovalProposal(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: { instrumentId: string; receiver: Party }
) {
    const issuer = userLedger.getPartyId();
    const contractId = await getLatestTransferPreapprovalProposal(userLedger, {
        ...params,
        issuer,
    });
    if (contractId) return contractId;

    await createTransferPreapprovalProposal(userLedger, userKeyPair, params);

    return (await getLatestTransferPreapprovalProposal(userLedger, {
        ...params,
        issuer,
    }))!;
}

export const getTransferPreapprovalProposalAcceptCommand = ({
    transferPreapprovalProposalContractId,
}: {
    transferPreapprovalProposalContractId: ContractId;
}): WrappedCommand => ({
    ExerciseCommand: {
        templateId: transferPreapprovalProposalTemplateId,
        choice: "MyTransferPreapprovalProposal_Accept",
        contractId: transferPreapprovalProposalContractId,
        choiceArgument: {},
    },
});

export interface TransferPreapprovalProposalAcceptParams {
    transferPreapprovalProposalContractId: ContractId;
}
export async function transferPreapprovalProposalAccept(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: {
        transferPreapprovalProposalContractId: ContractId;
    }
) {
    const transferPreapprovalProposalAcceptCommand =
        getTransferPreapprovalProposalAcceptCommand(params);

    await userLedger.prepareSignExecuteAndWaitFor(
        [transferPreapprovalProposalAcceptCommand],
        userKeyPair.privateKey,
        v4()
    );
}
