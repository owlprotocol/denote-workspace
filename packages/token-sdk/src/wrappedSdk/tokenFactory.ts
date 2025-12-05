import { LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ContractId, Party } from "../types/daml.js";
import { getCreateCommand } from "../helpers/getCreateCommand.js";
import { getExerciseCommand } from "../helpers/getExerciseCommand.js";
import { getLatestContract } from "../helpers/getLatestContract.js";

export interface TokenFactoryParams {
    issuer: Party;
    instrumentId: string;
}

export const tokenFactoryTemplateId =
    "#minimal-token:MyTokenFactory:MyTokenFactory";

const getCreateTokenFactoryCommand = (params: TokenFactoryParams) =>
    getCreateCommand({ templateId: tokenFactoryTemplateId, params });

// TODO: do not pass userKeyPair here
export async function createTokenFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    instrumentId: string
) {
    const issuer = userLedger.getPartyId();
    const createTokenFactoryCommand = getCreateTokenFactoryCommand({
        instrumentId,
        issuer,
    });

    /**
     * TODO: why can't we just use submitCommand here?
     * Full error:
     * {
     *   code: 'NO_SYNCHRONIZER_ON_WHICH_ALL_SUBMITTERS_CAN_SUBMIT',
     *   cause: 'This participant cannot submit as the given submitter on any connected synchronizer',
     *   correlationId: null,
     *   traceId: null,
     *   context: { definite_answer: 'false', category: '11' },
     *   resources: [],
     *   errorCategory: 11,
     *   grpcCodeValue: 5,
     *   retryInfo: null,
     *   definiteAnswer: null
     *  }
     */

    // const prepareTokenFactoryResponse = await userLedger.prepareSubmission(
    //     createTokenFactoryCommand
    // );
    //
    // const signedTokenFactoryCommandHash = signTransactionHash(
    //     prepareTokenFactoryResponse.preparedTransactionHash,
    //     userKeyPair.privateKey
    // );
    //
    // await userLedger.executeSubmissionAndWaitFor(
    //     prepareTokenFactoryResponse,
    //     signedTokenFactoryCommandHash,
    //     userKeyPair.publicKey,
    //     v4()
    // );
    //  TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [createTokenFactoryCommand],
        userKeyPair.privateKey,
        v4()
    );
}

const tokenFactoriesEqual = (a: TokenFactoryParams, b: TokenFactoryParams) =>
    a.instrumentId === b.instrumentId && a.issuer === b.issuer;

// Assumes owner is also the party
export async function getLatestTokenFactory(
    userLedger: LedgerController,
    instrumentId: string
) {
    const issuer = userLedger.getPartyId();

    const contractParamsToCompare = { instrumentId, issuer };
    return getLatestContract(
        userLedger,
        tokenFactoryTemplateId,
        contractParamsToCompare,
        tokenFactoriesEqual
    );
}

export async function getOrCreateTokenFactory(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    instrumentId: string
) {
    const contractId = await getLatestTokenFactory(userLedger, instrumentId);
    if (contractId) return contractId;

    await createTokenFactory(userLedger, userKeyPair, instrumentId);
    return (await getLatestTokenFactory(userLedger, instrumentId))!;
}

export interface MintTokenParams {
    receiver: Party;
    amount: number;
}

export const getMintTokenCommand = ({
    contractId,
    params,
}: {
    contractId: ContractId;
    params: MintTokenParams;
}) =>
    getExerciseCommand({
        templateId: tokenFactoryTemplateId,
        contractId,
        choice: "Mint",
        params,
    });

export async function mintToken(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    contractId: ContractId,
    params: MintTokenParams
) {
    const mintTokenCommand = getMintTokenCommand({ contractId, params });

    // TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [mintTokenCommand],
        userKeyPair.privateKey,
        v4()
    );
}
