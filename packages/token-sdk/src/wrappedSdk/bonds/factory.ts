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
}

const getCreateBondFactoryCommand = (params: BondFactoryParams) =>
    getCreateCommand({ templateId: bondFactoryTemplateId, params });

// TODO: do not pass userKeyPair here
export async function createBondFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    instrumentId: string
) {
    const issuer = userLedger.getPartyId();
    const createBondFactoryCommand = getCreateBondFactoryCommand({
        instrumentId,
        issuer,
    });
    await userLedger.prepareSignExecuteAndWaitFor(
        [createBondFactoryCommand],
        userKeyPair.privateKey,
        v4()
    );
}

const bondFactoriesEqual = (a: BondFactoryParams, b: BondFactoryParams) =>
    a.instrumentId === b.instrumentId && a.issuer === b.issuer;

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
    instrumentId: string
) {
    const contractId = await getLatestBondFactory(userLedger, instrumentId);
    if (contractId) return contractId;

    await createBondFactory(userLedger, userKeyPair, instrumentId);
    return (await getLatestBondFactory(userLedger, instrumentId))!;
}

export interface MintBondParams {
    depository: Party;
    receiver: Party;
    principal: number;
    maturityDate: string;
    couponRate: number;
    couponFrequency: number; // Int
}
