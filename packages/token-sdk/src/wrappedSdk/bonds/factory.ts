/**
 * BondFactory module for managing bond minting factories.
 *
 * BondFactory creates bond instrument definitions. The factory itself only stores the issuer and instrumentId.
 * Bond terms (notional, couponRate, couponFrequency, maturityDate) are specified when creating the instrument
 * via the CreateInstrument choice, not when creating the factory.
 *
 */

import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import {
    bondFactoryTemplateId,
    bondInstrumentTemplateId,
} from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";
import { ActiveContractResponse } from "../../types/ActiveContractResponse.js";
import { ContractId, Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";

/**
 * Parameters for creating a BondFactory contract.
 *
 * The factory only stores the issuer and instrumentId. Bond terms are specified
 * when creating the instrument via CreateInstrument choice.
 */
export interface BondFactoryParams {
    /** The party issuing the bonds */
    issuer: Party;
    /** Unique identifier for the bond instrument (e.g., "party123#Bond") */
    instrumentId: string;
    notional: number;
    couponRate: number;
    couponFrequency: number;
}

const getCreateBondFactoryCommand = (params: BondFactoryParams) =>
    getCreateCommand({ templateId: bondFactoryTemplateId, params });

/**
 * Creates a new BondFactory contract.
 *
 * The factory only stores the issuer and instrumentId. Bond terms (notional, couponRate,
 * couponFrequency, maturityDate) are specified later when creating the instrument via
 * the createBondInstrument function.
 *
 * @param userLedger - Ledger controller for the issuer party
 * @param userKeyPair - Key pair for signing the transaction
 * @param instrumentId - Unique identifier for the bond instrument (e.g., "party123#Bond")
 */
// TODO: do not pass userKeyPair here
export async function createBondFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    instrumentId: string,
    notional: number,
    couponRate: number,
    couponFrequency: number
) {
    const issuer = userLedger.getPartyId();
    const createBondFactoryCommand = getCreateBondFactoryCommand({
        instrumentId,
        issuer,
        notional,
        couponRate,
        couponFrequency,
    });
    await userLedger.prepareSignExecuteAndWaitFor(
        [createBondFactoryCommand],
        userKeyPair.privateKey,
        v4()
    );
}

const bondFactoriesEqual = (
    a: BondFactoryParams | { instrumentId: string; issuer: Party },
    b: BondFactoryParams | { instrumentId: string; issuer: Party }
) => a.instrumentId === b.instrumentId && a.issuer === b.issuer;

/**
 * Queries for the latest BondFactory contract with the specified instrument ID.
 *
 * @param userLedger - Ledger controller for the issuer party
 * @param instrumentId - Unique identifier for the bond instrument
 * @returns The contract ID of the latest matching factory, or undefined if not found
 */
// Assumes owner is also the party
export async function getLatestBondFactory(
    userLedger: LedgerController,
    instrumentId: string
) {
    const issuer = userLedger.getPartyId();

    const contractParamsToCompare = { instrumentId, issuer };
    return getLatestContract(
        userLedger,
        bondFactoryTemplateId,
        contractParamsToCompare,
        bondFactoriesEqual
    );
}

/**
 * Gets the latest BondFactory contract or creates a new one if it doesn't exist.
 *
 * This is a convenience function that queries for an existing factory and only creates
 * a new one if no matching factory is found for the given instrument ID.
 *
 * @param userLedger - Ledger controller for the issuer party
 * @param userKeyPair - Key pair for signing the transaction (only used if creating)
 * @param instrumentId - Unique identifier for the bond instrument (e.g., "party123#Bond")
 * @returns The contract ID of the existing or newly created factory
 */
export async function getOrCreateBondFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    instrumentId: string,
    notional: number,
    couponRate: number,
    couponFrequency: number
) {
    const contractId = await getLatestBondFactory(userLedger, instrumentId);
    if (contractId) return contractId;

    await createBondFactory(
        userLedger,
        userKeyPair,
        instrumentId,
        notional,
        couponRate,
        couponFrequency
    );
    return (await getLatestBondFactory(userLedger, instrumentId))!;
}

export interface CreateBondInstrumentParams {
    depository: Party;
    notional: number;
    couponRate: number;
    couponFrequency: number;
    maturityDate: string;
}

export interface BondInstrumentParams {
    issuer: Party;
    depository: Party;
    instrumentId: string;
    notional: number;
    couponRate: number;
    couponFrequency: number;
    maturityDate: string;
}

/**
 * Create a bond instrument via the factory.
 * This creates the instrument definition with all bond terms.
 * @param userLedger - The issuer's ledger controller
 * @param userKeyPair - The issuer's key pair for signing
 * @param bondFactoryCid - The bond factory contract ID
 * @param instrumentId - The instrument ID (from the factory)
 * @param params - Instrument creation parameters
 */
export async function createBondInstrument(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    bondFactoryCid: ContractId,
    instrumentId: string,
    params: CreateBondInstrumentParams
): Promise<ContractId> {
    const createInstrumentCommand = getExerciseCommand({
        templateId: bondFactoryTemplateId,
        contractId: bondFactoryCid,
        choice: "CreateInstrument",
        params: {
            depository: params.depository,
            notional: params.notional,
            couponRate: params.couponRate,
            couponFrequency: params.couponFrequency,
            maturityDate: params.maturityDate,
        },
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createInstrumentCommand],
        userKeyPair.privateKey,
        v4()
    );

    // Query for the newly created instrument
    const instrumentCid = await getLatestBondInstrument(
        userLedger,
        instrumentId
    );
    if (!instrumentCid) {
        throw new Error(
            "Failed to create bond instrument: instrument not found after creation"
        );
    }
    return instrumentCid;
}

/**
 * Get the latest bond instrument for a given instrument ID
 */
export async function getLatestBondInstrument(
    userLedger: LedgerController,
    instrumentId: string
): Promise<ContractId | undefined> {
    const issuer = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [bondInstrumentTemplateId],
    })) as ActiveContractResponse<BondInstrumentParams>[];

    // Filter by instrumentId
    for (const contract of activeContracts) {
        const jsActive = contract.contractEntry.JsActiveContract;
        if (!jsActive) continue;
        const { createArgument } = jsActive.createdEvent;
        if (
            createArgument.instrumentId === instrumentId &&
            createArgument.issuer === issuer
        ) {
            return jsActive.createdEvent.contractId;
        }
    }
    return undefined;
}
