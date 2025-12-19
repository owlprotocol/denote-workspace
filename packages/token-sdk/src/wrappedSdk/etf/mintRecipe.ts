import { LedgerController } from "@canton-network/wallet-sdk";
import { mintRecipeTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { v4 } from "uuid";
import { PortfolioItem } from "./portfolioComposition.js";

export interface MintRecipeParams {
    issuer: Party;
    instrumentId: string;
    authorizedMinters: Party[];
    composition: ContractId;
}

export interface AddAuthorizedMinterParams {
    newMinter: Party;
}

export interface RemoveAuthorizedMinterParams {
    minterToRemove: Party;
}

export interface UpdateCompositionParams {
    newComposition: ContractId;
}

export interface CreateAndUpdateCompositionParams {
    newCompositionItems: PortfolioItem[];
    compositionName: string;
    archiveOld: boolean;
}

const getCreateMintRecipeCommand = (params: MintRecipeParams) =>
    getCreateCommand({ templateId: mintRecipeTemplateId, params });

/**
 * Create a mint recipe
 * @param userLedger - The user's ledger controller
 * @param userKeyPair - The user's key pair for signing
 * @param params - Mint recipe parameters
 */
export async function createMintRecipe(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: MintRecipeParams
) {
    const createMintRecipeCommand = getCreateMintRecipeCommand(params);

    await userLedger.prepareSignExecuteAndWaitFor(
        [createMintRecipeCommand],
        userKeyPair.privateKey,
        v4()
    );
}

/**
 * Get the latest mint recipe for a given instrument
 * @param userLedger - The user's ledger controller
 * @param instrumentId - The instrument ID of the ETF
 */
export async function getLatestMintRecipe(
    userLedger: LedgerController,
    instrumentId: string
): Promise<ContractId | undefined> {
    const issuer = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [mintRecipeTemplateId],
    })) as ActiveContractResponse<MintRecipeParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.issuer === issuer &&
            createArgument.instrumentId === instrumentId
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }

    const contract = filteredEntries[filteredEntries.length - 1];
    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
}

/**
 * Get existing or create new mint recipe
 * @param userLedger - The user's ledger controller
 * @param userKeyPair - The user's key pair for signing
 * @param params - Mint recipe parameters
 */
export async function getOrCreateMintRecipe(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: MintRecipeParams
): Promise<ContractId> {
    const existing = await getLatestMintRecipe(userLedger, params.instrumentId);
    if (existing) {
        return existing;
    }

    await createMintRecipe(userLedger, userKeyPair, params);
    const created = await getLatestMintRecipe(userLedger, params.instrumentId);
    if (!created) {
        throw new Error("Failed to create mint recipe");
    }
    return created;
}

/**
 * Add an authorized minter to the mint recipe
 * @param userLedger - The issuer's ledger controller
 * @param userKeyPair - The issuer's key pair for signing
 * @param contractId - The mint recipe contract ID
 * @param params - Parameters with newMinter
 */
export async function addAuthorizedMinter(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: AddAuthorizedMinterParams
) {
    const addMinterCommand = getExerciseCommand({
        templateId: mintRecipeTemplateId,
        contractId,
        choice: "MyMintRecipe_AddAuthorizedMinter",
        params,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [addMinterCommand],
        userKeyPair.privateKey,
        v4()
    );
}

/**
 * Remove an authorized minter from the mint recipe
 * @param userLedger - The issuer's ledger controller
 * @param userKeyPair - The issuer's key pair for signing
 * @param contractId - The mint recipe contract ID
 * @param params - Parameters with minterToRemove
 */
export async function removeAuthorizedMinter(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: RemoveAuthorizedMinterParams
) {
    const removeMinterCommand = getExerciseCommand({
        templateId: mintRecipeTemplateId,
        contractId,
        choice: "MyMintRecipe_RemoveAuthorizedMinter",
        params,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [removeMinterCommand],
        userKeyPair.privateKey,
        v4()
    );
}

/**
 * Update the composition reference in the mint recipe
 * @param userLedger - The issuer's ledger controller
 * @param userKeyPair - The issuer's key pair for signing
 * @param contractId - The mint recipe contract ID
 * @param params - Parameters with newComposition CID
 */
export async function updateComposition(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: UpdateCompositionParams
) {
    const updateCommand = getExerciseCommand({
        templateId: mintRecipeTemplateId,
        contractId,
        choice: "MyMintRecipe_UpdateComposition",
        params,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [updateCommand],
        userKeyPair.privateKey,
        v4()
    );
}

/**
 * Create a new composition and update the mint recipe to reference it
 * @param userLedger - The issuer's ledger controller
 * @param userKeyPair - The issuer's key pair for signing
 * @param contractId - The mint recipe contract ID
 * @param params - Parameters with new composition items, name, and archiveOld flag
 */
export async function createAndUpdateComposition(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: CreateAndUpdateCompositionParams
) {
    const createAndUpdateCommand = getExerciseCommand({
        templateId: mintRecipeTemplateId,
        contractId,
        choice: "MyMintRecipe_CreateAndUpdateComposition",
        params,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createAndUpdateCommand],
        userKeyPair.privateKey,
        v4()
    );
}
