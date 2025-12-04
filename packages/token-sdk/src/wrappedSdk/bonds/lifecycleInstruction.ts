import { LedgerController } from "@canton-network/wallet-sdk";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { v4 } from "uuid";
import { Types } from "@canton-network/core-ledger-client";
import {
    bondFactoryTemplateId,
    bondLifecycleInstructionTemplateId,
} from "../../constants/templateIds.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { getContractDisclosure } from "../contractDisclosure.js";

export async function processBondLifecycleInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId,
    disclosedContracts?: Types["DisclosedContract"][]
) {
    const processCommand = getExerciseCommand({
        templateId: bondLifecycleInstructionTemplateId,
        contractId,
        choice: "Process",
        params: {},
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [processCommand],
        keyPair.privateKey,
        v4(),
        disclosedContracts
    );
}

export async function abortBondLifecycleInstruction(
    ledger: LedgerController,
    keyPair: UserKeyPair,
    contractId: ContractId
) {
    const abortCommand = getExerciseCommand({
        templateId: bondLifecycleInstructionTemplateId,
        contractId,
        choice: "Abort",
        params: {},
    });

    await ledger.prepareSignExecuteAndWaitFor(
        [abortCommand],
        keyPair.privateKey,
        v4()
    );
}

export async function getLatestBondLifecycleInstruction(
    ledger: LedgerController,
    party: Party
): Promise<ContractId> {
    const end = await ledger.ledgerEnd();
    const instructions = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondLifecycleInstructionTemplateId],
        filterByParty: true,
        parties: [party],
    })) as ActiveContractResponse[];

    if (instructions.length === 0) {
        throw new Error("Bond lifecycle instruction not found");
    }

    const instructionCid =
        instructions[instructions.length - 1].contractEntry.JsActiveContract
            ?.createdEvent.contractId;
    if (!instructionCid) {
        throw new Error("Bond lifecycle instruction CID not found");
    }

    return instructionCid;
}

export async function getBondLifecycleInstruction(
    ledger: LedgerController,
    contractId: ContractId
) {
    const end = await ledger.ledgerEnd();
    const instructions = (await ledger.activeContracts({
        offset: end.offset,
        templateIds: [bondLifecycleInstructionTemplateId],
        filterByParty: true,
        parties: [ledger.getPartyId()],
    })) as ActiveContractResponse<{
        eventType: unknown;
        lockedBond: ContractId;
        bondFactoryCid: ContractId | null;
        producedVersion: string | null;
        issuer: string;
        holder: string;
        eventDate: string;
        amount: number;
        currencyInstrumentId: unknown;
    }>[];

    const instruction = instructions.find(
        (inst) =>
            inst.contractEntry.JsActiveContract?.createdEvent.contractId ===
            contractId
    );

    if (!instruction?.contractEntry.JsActiveContract) {
        return undefined;
    }

    return instruction.contractEntry.JsActiveContract.createdEvent;
}

export async function getBondLifecycleInstructionDisclosure(
    issuerLedger: LedgerController,
    lifecycleInstructionCid: ContractId
): Promise<Types["DisclosedContract"] | undefined> {
    const instruction = await getBondLifecycleInstruction(
        issuerLedger,
        lifecycleInstructionCid
    );

    if (!instruction) {
        throw new Error("Bond lifecycle instruction not found");
    }

    if (!instruction.createArgument.bondFactoryCid) {
        return undefined;
    }

    return getContractDisclosure(issuerLedger, {
        templateId: bondFactoryTemplateId,
        contractId: instruction.createArgument.bondFactoryCid,
    });
}
