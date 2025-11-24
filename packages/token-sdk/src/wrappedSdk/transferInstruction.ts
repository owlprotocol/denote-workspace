import { LedgerController } from "@canton-network/wallet-sdk";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";
import { ContractId } from "../types/daml.js";
import { ExtraArgs } from "./transferRequest.js";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { v4 } from "uuid";
import { Types } from "@canton-network/core-ledger-client";

// Use the Splice API interface ID (must match the package name in the DAR)
const TRANSFER_INSTRUCTION_INTERFACE_ID =
    "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction";

export interface TransferInstructionAcceptParams {
    extraArgs: ExtraArgs;
}

const emptyExtraArgs = (): TransferInstructionAcceptParams => ({
    extraArgs: {
        context: { values: {} },
        meta: { values: {} },
    },
});

export const getTransferInstructionAcceptCommand = ({
    contractId,
    params,
}: {
    contractId: ContractId;
    params?: TransferInstructionAcceptParams;
}) =>
    getExerciseCommand({
        templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,
        params: params ?? emptyExtraArgs(),
        contractId,
        choice: "TransferInstruction_Accept",
    });

export async function acceptTransferInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId,
    disclosedContracts?: Types["DisclosedContract"][],
    params?: TransferInstructionAcceptParams
) {
    const acceptCommand = getTransferInstructionAcceptCommand({
        contractId,
        params,
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        keyPair.privateKey,
        v4(),
        disclosedContracts
    );
}
