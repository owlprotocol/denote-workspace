import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { TokenFactoryParams } from "./tokenFactory.js";
import { transferPreapprovalTemplateId } from "../constants/templateIds.js";
import { ContractId, Party } from "../types/daml.js";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";

export type TransferPreapprovalParams = TokenFactoryParams & {
    receiver: Party;
};

export async function getLatestTransferPreapproval(
    userLedger: LedgerController,
    {
        issuer,
        receiver,
        instrumentId,
    }: { issuer: Party; receiver: Party; instrumentId: string }
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

export interface TransferPreapprovalSendParams {
    sender: Party;
    tokenCid: ContractId;
    amount: number;
}

export const getTransferPreapprovalSendCommand = ({
    contractId,
    params,
}: {
    contractId: ContractId;
    params: TransferPreapprovalSendParams;
}) =>
    getExerciseCommand({
        contractId,
        params,
        templateId: transferPreapprovalTemplateId,
        choice: "MyTransferPreapproval_Send",
    });

export async function transferPreapprovalSend(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: TransferPreapprovalSendParams
) {
    const transferPreapprovalSendCommand = getTransferPreapprovalSendCommand({
        contractId,
        params,
    });

    return await userLedger.prepareSignExecuteAndWaitFor(
        [transferPreapprovalSendCommand],
        userKeyPair.privateKey,
        v4()
    );
}
