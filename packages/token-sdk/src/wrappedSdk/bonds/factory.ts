import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { bondFactoryTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";
import { Party } from "../../types/daml.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";

export interface BondFactoryParams {
    issuer: Party;
    instrumentId: string;
    notional: number;
    couponRate: number;
    couponFrequency: number;
}

const getCreateBondFactoryCommand = (params: BondFactoryParams) =>
    getCreateCommand({ templateId: bondFactoryTemplateId, params });

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

export interface MintBondParams {
    depository: Party;
    receiver: Party;
    amount: number;
    maturityDate: string;
}
