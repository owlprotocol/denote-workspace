import { WrappedCommand, LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { TokenFactoryParams } from "./tokenFactory.js";
import { transferPreapprovalTemplateId } from "../constants/templateIds.js";

export type TransferPreapprovalParams = TokenFactoryParams & {
    receiver: string;
};

export async function getLatestTransferPreapproval(
    userLedger: LedgerController,
    {
        issuer,
        receiver,
        instrumentId,
    }: { issuer: string; receiver: string; instrumentId: string }
) {
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [receiver],
        templateIds: [transferPreapprovalTemplateId],
    })) as ActiveContractResponse<TransferPreapprovalParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.issuer === issuer &&
            createArgument.receiver === receiver &&
            createArgument.instrumentId === instrumentId
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

export const getTransferPreapprovalSendCommand = ({
    transferPreapprovalContractId,
    sender,
    amount,
    tokenCid,
}: {
    transferPreapprovalContractId: string;
    sender: string;
    amount: number;
    tokenCid: string;
}): WrappedCommand => ({
    ExerciseCommand: {
        templateId: transferPreapprovalTemplateId,
        choice: "MyTransferPreapproval_Send",
        contractId: transferPreapprovalContractId,
        choiceArgument: {
            sender,
            amount,
            tokenCid,
        },
    },
});

export interface TransferPreapprovalSendParams {
    transferPreapprovalContractId: string;
    sender: string;
    tokenCid: string;
    amount: number;
}

export async function transferPreapprovalSend(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: TransferPreapprovalSendParams
) {
    const transferPreapprovalSendCommand =
        getTransferPreapprovalSendCommand(params);

    return await userLedger.prepareSignExecuteAndWaitFor(
        [transferPreapprovalSendCommand],
        userKeyPair.privateKey,
        v4()
    );
}
