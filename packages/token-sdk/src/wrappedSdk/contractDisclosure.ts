import { Types } from "@canton-network/core-ledger-client";
import { LedgerController } from "@canton-network/wallet-sdk";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId } from "../types/daml.js";

/**
 * Get disclosure information for a contract
 *
 * This is a generic function that can be used to get disclosure for any contract
 * that the given party can see. The returned disclosure can be used with
 * submitWithDisclosures or in the disclosedContracts field of the prepare API.
 *
 * @param userLedger - The ledger controller for a party that can see the contract
 * @param templateId - The template ID of the contract (e.g., "#minimal-token:MyToken:MyToken")
 * @param contractId - The contract ID to get disclosure for
 * @returns A DisclosedContract object with contractId, createdEventBlob, templateId, and synchronizerId
 */
export async function getContractDisclosure(
    userLedger: LedgerController,
    { templateId, contractId }: { templateId: string; contractId: ContractId }
): Promise<Types["DisclosedContract"]> {
    const end = await userLedger.ledgerEnd();
    const user = userLedger.getPartyId();
    const activeContractsByTemplate = (await userLedger.activeContracts({
        offset: end.offset,
        templateIds: [templateId],
        filterByParty: true,
        parties: [user],
    })) as ActiveContractResponse[];

    const contract = activeContractsByTemplate.find(
        (c) =>
            c.contractEntry.JsActiveContract?.createdEvent.contractId ===
            contractId
    );
    if (!contract) {
        throw new Error(
            `Contract not found: ${contractId} with template ${templateId}`
        );
    }
    const { createdEvent, synchronizerId } =
        contract.contractEntry.JsActiveContract!;

    return {
        contractId,
        createdEventBlob: createdEvent.createdEventBlob,
        templateId,
        synchronizerId,
    };
}
