import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { bondLifecycleClaimRequestTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";

export interface BondLifecycleClaimRequestParams {
    effectCid: ContractId;
    bondHoldingCid: ContractId;
    bondRulesCid: ContractId;
    bondFactoryCid: ContractId;
    currencyTransferFactoryCid: ContractId;
    issuerCurrencyHoldingCid: ContractId;
    holder: Party;
    issuer: Party;
}

const getCreateBondLifecycleClaimRequestCommand = (
    params: BondLifecycleClaimRequestParams
) =>
    getCreateCommand({
        templateId: bondLifecycleClaimRequestTemplateId,
        params,
    });

export async function createBondLifecycleClaimRequest(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: BondLifecycleClaimRequestParams
) {
    const createMintRequestCommand =
        getCreateBondLifecycleClaimRequestCommand(params);

    await userLedger.prepareSignExecuteAndWaitFor(
        [createMintRequestCommand],
        userKeyPair.privateKey,
        v4()
    );
}

// TODO: handle both issuer and receiver querying
export async function getAllBondLifecycleClaimRequests(
    userLedger: LedgerController,
    issuer: Party
) {
    const partyId = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [partyId],
        templateIds: [bondLifecycleClaimRequestTemplateId],
    })) as ActiveContractResponse<BondLifecycleClaimRequestParams>[];

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            (createArgument.holder === partyId &&
                createArgument.issuer === issuer) ||
            createArgument.issuer === partyId
        );
    });

    return filteredEntries.map((contract) => {
        return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
    });
}

const issuerHolderEqual = (
    a: { issuer: Party; holder: Party },
    b: { issuer: Party; holder: Party }
) => a.issuer === b.issuer && a.holder === b.holder;

// TODO: fix param types to be more specific, or is it not needed?

export async function getLatestBondLifecycleClaimRequest(
    userLedger: LedgerController,
    issuer: Party
) {
    const holder = userLedger.getPartyId();

    return getLatestContract(
        userLedger,
        bondLifecycleClaimRequestTemplateId,
        { issuer, holder },
        issuerHolderEqual
    );
}

/**
 * Accept an lifecycle claim request (issuer action)
 * Creates transfer instructions for the user
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The lifecycle contract ID
 */
export async function acceptBondLifecycleClaimRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const acceptCommand = getExerciseCommand({
        templateId: bondLifecycleClaimRequestTemplateId,
        contractId,
        choice: "Accept",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [acceptCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Decline an lifecycle claim request (issuer action)
 * @param issuerLedger - The issuer's ledger controller
 * @param issuerKeyPair - The issuer's key pair for signing
 * @param contractId - The lifecycle contract ID
 */
export async function declineBondLifecycleClaimRequest(
    issuerLedger: LedgerController,
    issuerKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const declineCommand = getExerciseCommand({
        templateId: bondLifecycleClaimRequestTemplateId,
        contractId,
        choice: "Decline",
        params: {},
    });

    await issuerLedger.prepareSignExecuteAndWaitFor(
        [declineCommand],
        issuerKeyPair.privateKey,
        v4()
    );
}

/**
 * Withdraw an lifecycle claim request
 * @param holderLedger - The holder's ledger controller
 * @param holderKeyPair - The holder's key pair for signing
 * @param contractId - The lifecycle contract ID
 */
export async function withdrawBondLifecycleClaimRequest(
    holderLedger: LedgerController,
    holderKeyPair: UserKeyPair,
    contractId: ContractId
) {
    const withdrawCommand = getExerciseCommand({
        templateId: bondLifecycleClaimRequestTemplateId,
        contractId,
        choice: "Withdraw",
        params: {},
    });

    await holderLedger.prepareSignExecuteAndWaitFor(
        [withdrawCommand],
        holderKeyPair.privateKey,
        v4()
    );
}
