/**
 * BondFactory module for managing bond minting factories.
 *
 * Unlike token factories, BondFactory stores the bond's terms (notional, couponRate, couponFrequency).
 * All bonds minted from a specific factory share these terms - only the amount and maturityDate vary per mint.
 *
 */

import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { bondFactoryTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";
import { Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";

/**
 * Parameters for creating a BondFactory contract.
 *
 * The factory stores bond terms that are shared by all bonds minted from it.
 */
export interface BondFactoryParams {
    /** The party issuing the bonds */
    issuer: Party;
    /** Unique identifier for the bond instrument (e.g., "party123#Bond") */
    instrumentId: string;
    /** Face value per bond unit (e.g., 1000 means each bond has $1000 face value) */
    notional: number;
    /** Annual coupon rate as a decimal (e.g., 0.05 = 5% annual interest) */
    couponRate: number;
    /** Number of coupon payments per year (e.g., 2 = semi-annual, 4 = quarterly) */
    couponFrequency: number;
}

const getCreateBondFactoryCommand = (params: BondFactoryParams) =>
    getCreateCommand({ templateId: bondFactoryTemplateId, params });

/**
 * Creates a new BondFactory contract with specified bond terms.
 *
 * The factory stores bond terms (notional, couponRate, couponFrequency) that are shared by all bonds
 * minted from this factory. Only the amount and maturityDate vary per individual bond mint.
 *
 * @param userLedger - Ledger controller for the issuer party
 * @param userKeyPair - Key pair for signing the transaction
 * @param instrumentId - Unique identifier for the bond instrument (e.g., "party123#Bond")
 * @param notional - Face value per bond unit (e.g., 1000 = $1000 face value per bond)
 * @param couponRate - Annual coupon rate as decimal (e.g., 0.05 = 5% annual)
 * @param couponFrequency - Coupon payments per year (e.g., 2 = semi-annual)
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
 * @param notional - Face value per bond unit (e.g., 1000 = $1000 face value per bond)
 * @param couponRate - Annual coupon rate as decimal (e.g., 0.05 = 5% annual)
 * @param couponFrequency - Coupon payments per year (e.g., 2 = semi-annual)
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
