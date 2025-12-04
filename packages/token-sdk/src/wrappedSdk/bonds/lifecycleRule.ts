import { LedgerController } from "@canton-network/wallet-sdk";
import { bondLifecycleRuleTemplateId } from "../../constants/templateIds.js";
import { getCreateCommand } from "../../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../../helpers/getExerciseCommand.js";
import { ContractId, Party } from "../../types/daml.js";
import { InstrumentId } from "../../types/InstrumentId.js";
import { UserKeyPair } from "../../types/UserKeyPair.js";
import { v4 } from "uuid";
import { instrumentIdsEqual } from "../../helpers/instrumentIdsEqual.js";
import { getLatestContract } from "../../helpers/getLatestContract.js";

export interface CreateBondLifecycleRuleParams {
    depository: Party;
    currencyInstrumentId: InstrumentId;
}

export type BondLifecycleRuleParams = CreateBondLifecycleRuleParams & {
    issuer: Party;
};

const getCreateBondLifecycleRuleCommand = (params: BondLifecycleRuleParams) =>
    getCreateCommand({ templateId: bondLifecycleRuleTemplateId, params });

export async function createBondLifecycleRule(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: CreateBondLifecycleRuleParams
) {
    const issuer = userLedger.getPartyId();
    const createBondLifecycleRuleCommand = getCreateBondLifecycleRuleCommand({
        issuer,
        ...params,
    });

    await userLedger.prepareSignExecuteAndWaitFor(
        [createBondLifecycleRuleCommand],
        userKeyPair.privateKey,
        v4()
    );
}

const bondLifecycleRulesEqual = (
    a: BondLifecycleRuleParams,
    b: BondLifecycleRuleParams
) =>
    a.issuer === b.issuer &&
    a.depository === b.depository &&
    instrumentIdsEqual(a.currencyInstrumentId, b.currencyInstrumentId);

export async function getLatestBondLifecycleRule(
    userLedger: LedgerController,
    {
        depository,
        currencyInstrumentId,
    }: { depository: Party; currencyInstrumentId: InstrumentId }
) {
    const issuer = userLedger.getPartyId();

    const contractParamsToCompare = {
        issuer,
        depository,
        currencyInstrumentId,
    };
    return getLatestContract(
        userLedger,
        bondLifecycleRuleTemplateId,
        contractParamsToCompare,
        bondLifecycleRulesEqual
    );
}

export async function getOrCreateBondLifecycleRule(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: CreateBondLifecycleRuleParams
) {
    const contractId = await getLatestBondLifecycleRule(userLedger, params);
    if (contractId) return contractId;

    await createBondLifecycleRule(userLedger, userKeyPair, params);
    return (await getLatestBondLifecycleRule(userLedger, params))!;
}

export interface ProcessCouponPaymentEventParams {
    targetInstrumentId: string;
    targetVersion: string;
    couponRate: number;
    couponFrequency: number; // Int
    principalPerUnit: number;
}

export const getProcessCouponPaymentEventCommand = ({
    contractId,
    params,
}: {
    contractId: ContractId;
    params: ProcessCouponPaymentEventParams;
}) =>
    getExerciseCommand({
        templateId: bondLifecycleRuleTemplateId,
        contractId,
        choice: "ProcessCouponPaymentEvent",
        params,
    });

export async function processCouponPaymentEvent(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: ProcessCouponPaymentEventParams
) {
    const processCouponPaymentEventCommand =
        getProcessCouponPaymentEventCommand({
            contractId,
            params,
        });

    // TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [processCouponPaymentEventCommand],
        userKeyPair.privateKey,
        v4()
    );
}

export interface ProcessRedemptionEventParams {
    targetInstrumentId: string;
    targetVersion: string;
    principalPerUnit: number;
    couponRate: number;
    couponFrequency: number; // Int
}

export const getProcessRedemptionEventCommand = ({
    contractId,
    params,
}: {
    contractId: ContractId;
    params: ProcessRedemptionEventParams;
}) =>
    getExerciseCommand({
        templateId: bondLifecycleRuleTemplateId,
        contractId,
        choice: "ProcessRedemptionEvent",
        params,
    });

export async function processRedemptionEvent(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: ProcessRedemptionEventParams
) {
    const processRedemptionEventCommand = getProcessRedemptionEventCommand({
        contractId,
        params,
    });

    // TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [processRedemptionEventCommand],
        userKeyPair.privateKey,
        v4()
    );
}
