import { Types } from "@canton-network/core-ledger-client";
import { LedgerController } from "@canton-network/wallet-sdk";
import { ContractId, Party } from "../types/daml.js";
import { getContractDisclosure } from "./contractDisclosure.js";
import {
    bondInstrumentTemplateId,
    lockedBondTemplateId,
    lockedMyTokenTemplateId,
    tokenTemplateId,
    tokenTransferInstructionTemplateId,
} from "../constants/templateIds.js";
import { getCreatedEventByCid } from "../helpers/getCreatedEventByCid.js";
import { CreatedEvent } from "../types/CreatedEvent.js";

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
    transferInstruction: CreatedEvent<MyTransferInstructionParams>;
}> {
    const instruction = await getCreatedEventByCid<MyTransferInstructionParams>(
        adminLedger,
        transferInstructionCid,
        tokenTransferInstructionTemplateId
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
        templateId: tokenTemplateId,
        contractId: tokenCid,
    });
}

export async function getBondInstrumentDisclosure(
    ledger: LedgerController,
    bondInstrumentCid: ContractId
): Promise<Types["DisclosedContract"]> {
    return getContractDisclosure(ledger, {
        templateId: bondInstrumentTemplateId,
        contractId: bondInstrumentCid,
    });
}

/**
 * Get disclosure for a LockedBond contract
 * Useful when the receiver needs to see a locked bond that's owned by sender and issuer
 *
 * @param ledger - Ledger controller for a party that can see the locked bond (issuer or sender)
 * @param lockedBondCid - The LockedBond contract ID
 * @returns Disclosure object for the locked bond
 */
export async function getLockedBondDisclosure(
    ledger: LedgerController,
    lockedBondCid: ContractId
): Promise<Types["DisclosedContract"]> {
    return getContractDisclosure(ledger, {
        templateId: lockedBondTemplateId,
        contractId: lockedBondCid,
    });
}
