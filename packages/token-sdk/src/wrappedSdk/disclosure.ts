import { Types } from "@canton-network/core-ledger-client";
import { LedgerController } from "@canton-network/wallet-sdk";
import { ContractId, Party } from "../types/daml.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { getContractDisclosure } from "./contractDisclosure.js";
import {
    lockedMyTokenTemplateId,
    tokenTransferInstructionTemplateId,
} from "../constants/templateIds.js";

/**
 * Disclosure-related types and helpers for three-party transfer flows
 *
 * In the three-party transfer pattern:
 * 1. Admin creates MyTransferInstruction with a locked token
 * 2. Receiver needs disclosure to see the LockedMyToken (where admin + sender are signatories)
 * 3. Receiver uses disclosure when accepting/rejecting the transfer
 */

export interface MyTransferInstructionParams {
    lockedMyToken: ContractId;
    transfer: {
        sender: Party;
        receiver: Party;
        amount: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

/**
 * Get the MyTransferInstruction contract to extract the locked token CID
 * This is needed to get disclosure for the receiver party
 *
 * @param adminLedger - The admin/issuer's ledger controller who can see the instruction
 * @param transferInstructionCid - The transfer instruction contract ID
 * @returns The transfer instruction contract data
 */
export async function getTransferInstruction(
    adminLedger: LedgerController,
    transferInstructionCid: ContractId
) {
    const admin = adminLedger.getPartyId();
    const end = await adminLedger.ledgerEnd();
    const activeContracts = (await adminLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [admin],
        templateIds: [tokenTransferInstructionTemplateId],
    })) as ActiveContractResponse<MyTransferInstructionParams>[];

    const contract = activeContracts.find(
        ({ contractEntry }) =>
            contractEntry.JsActiveContract?.createdEvent.contractId ===
            transferInstructionCid
    );

    if (!contract?.contractEntry.JsActiveContract) {
        throw new Error(
            `Transfer instruction not found: ${transferInstructionCid}`
        );
    }

    return contract.contractEntry.JsActiveContract.createdEvent;
}

/**
 * Get disclosure information for a transfer instruction
 * The admin/issuer can see both the MyTransferInstruction and the LockedMyToken
 * This disclosure is needed for the receiver to accept/reject the transfer
 *
 * @param adminLedger - The admin/issuer's ledger controller
 * @param transferInstructionCid - The transfer instruction contract ID
 * @returns Disclosure object for the locked token and transfer instruction details
 */
export async function getTransferInstructionDisclosure(
    adminLedger: LedgerController,
    transferInstructionCid: ContractId
): Promise<{
    lockedTokenDisclosure: Types["DisclosedContract"];
    transferInstruction: Awaited<ReturnType<typeof getTransferInstruction>>;
}> {
    const instruction = await getTransferInstruction(
        adminLedger,
        transferInstructionCid
    );
    const lockedTokenCid = instruction.createArgument.lockedMyToken;

    // Use the generic getContractDisclosure function
    const lockedTokenDisclosure = await getContractDisclosure(adminLedger, {
        templateId: lockedMyTokenTemplateId,
        contractId: lockedTokenCid,
    });

    return {
        lockedTokenDisclosure,
        transferInstruction: instruction,
    };
}

/**
 * Get disclosure for a MyToken contract
 * Useful when the receiver needs to see a token that's owned by sender and issuer
 *
 * @param ledger - Ledger controller for a party that can see the token (issuer or owner)
 * @param tokenCid - The MyToken contract ID
 * @returns Disclosure object for the token
 */
export async function getMyTokenDisclosure(
    ledger: LedgerController,
    tokenCid: ContractId
): Promise<Types["DisclosedContract"]> {
    return getContractDisclosure(ledger, {
        templateId: "#minimal-token:MyToken:MyToken",
        contractId: tokenCid,
    });
}
