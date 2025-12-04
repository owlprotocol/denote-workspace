import { LedgerController } from "@canton-network/wallet-sdk";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ContractId } from "../../types/daml.js";
import { ExtraArgs } from "../transferRequest.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { v4 } from "uuid";
import { Types } from "@canton-network/core-ledger-client";
import {
    bondTransferInstructionTemplateId,
    lockedBondTemplateId,
} from "../../constants/templateIds.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { getContractDisclosure } from "../contractDisclosure.js";

const TRANSFER_INSTRUCTION_INTERFACE_ID =
    "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferInstruction";

export interface BondTransferInstructionAcceptParams {
    extraArgs: ExtraArgs;
}

const emptyExtraArgs = (): BondTransferInstructionAcceptParams => ({
    extraArgs: {
        context: { values: {} },
        meta: { values: {} },
    },
});

export async function acceptBondTransferInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId,
    disclosedContracts?: Types["DisclosedContract"][],
    params?: BondTransferInstructionAcceptParams
) {
    const acceptCommand = getExerciseCommand({
        templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,
        params: params ?? emptyExtraArgs(),
        contractId,
        choice: "TransferInstruction_Accept",
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        keyPair.privateKey,
        v4(),
        disclosedContracts
    );
}

export async function rejectBondTransferInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId,
    disclosedContracts?: Types["DisclosedContract"][],
    params?: BondTransferInstructionAcceptParams
) {
    const rejectCommand = getExerciseCommand({
        templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,
        params: params ?? emptyExtraArgs(),
        contractId,
        choice: "TransferInstruction_Reject",
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [rejectCommand],
        keyPair.privateKey,
        v4(),
        disclosedContracts
    );
}

export async function withdrawBondTransferInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId,
    params?: BondTransferInstructionAcceptParams
) {
    const withdrawCommand = getExerciseCommand({
        templateId: TRANSFER_INSTRUCTION_INTERFACE_ID,
        params: params ?? emptyExtraArgs(),
        contractId,
        choice: "TransferInstruction_Withdraw",
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        keyPair.privateKey,
        v4()
    );
}

export async function getLatestBondTransferInstruction(
    ledger: LedgerController,
    party: string
): Promise<ContractId | undefined> {
    const end = await ledger.ledgerEnd();
    const instructions = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondTransferInstructionTemplateId],
        filterByParty: true,
        parties: [party],
    })) as ActiveContractResponse[];

    if (instructions.length === 0) {
        return undefined;
    }

    const latest = instructions[instructions.length - 1];
    return latest.contractEntry.JsActiveContract?.createdEvent.contractId;
}

export async function getBondTransferInstructionDisclosure(
    adminLedger: LedgerController,
    transferInstructionCid: ContractId
): Promise<Types["DisclosedContract"]> {
    const end = await adminLedger.ledgerEnd();
    const instructions = (await adminLedger.activeContracts({
        offset: end.offset,
        templateIds: [bondTransferInstructionTemplateId],
        filterByParty: true,
        parties: [adminLedger.getPartyId()],
    })) as ActiveContractResponse<{
        lockedBond: ContractId;
        transfer: unknown;
    }>[];

    const instruction = instructions.find(
        (inst) =>
            inst.contractEntry.JsActiveContract?.createdEvent.contractId ===
            transferInstructionCid
    );

    if (!instruction?.contractEntry.JsActiveContract) {
        throw new Error("Bond transfer instruction not found");
    }

    const lockedBondCid =
        instruction.contractEntry.JsActiveContract.createdEvent.createArgument
            .lockedBond;

    return getContractDisclosure(adminLedger, {
        templateId: lockedBondTemplateId,
        contractId: lockedBondCid,
    });
}
