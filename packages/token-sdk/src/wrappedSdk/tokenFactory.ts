import { WrappedCommand, LedgerController } from "@canton-network/wallet-sdk";
import { v4 } from "uuid";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";
import { ContractId, Party } from "../types/daml.js";

export interface TokenFactoryParams {
    issuer: Party;
    instrumentId: string;
}

export const tokenFactoryTemplateId =
    "#minimal-token:MyTokenFactory:MyTokenFactory";

const getCreateTokenFactoryCommand = ({
    instrumentId,
    issuer,
}: {
    instrumentId: string;
    issuer: Party;
}): WrappedCommand => ({
    CreateCommand: {
        templateId: tokenFactoryTemplateId,
        createArguments: {
            issuer,
            instrumentId,
        },
    },
});

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

// Assumes owner is also the party
export async function getLatestTokenFactory(
    userLedger: LedgerController,
    instrumentId: string
) {
    const issuer = userLedger.getPartyId();
    const end = await userLedger.ledgerEnd();
    const activeContracts = (await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [tokenFactoryTemplateId],
    })) as ActiveContractResponse<TokenFactoryParams>[];

    if (activeContracts.length === 0) {
        return;
    }

    const filteredEntries = activeContracts.filter(({ contractEntry }) => {
        const jsActive = contractEntry.JsActiveContract;
        if (!jsActive) return false;
        const { createArgument } = jsActive.createdEvent;
        return (
            createArgument.instrumentId === instrumentId &&
            createArgument.issuer === issuer
        );
    });

    if (filteredEntries.length === 0) {
        return;
    }
    const contract = filteredEntries[filteredEntries.length - 1];

    return contract.contractEntry.JsActiveContract!.createdEvent.contractId;
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

export const getMintTokenCommand = ({
    tokenFactoryContractId,
    receiver,
    amount,
}: {
    tokenFactoryContractId: ContractId;
    receiver: Party;
    amount: number;
}): WrappedCommand => ({
    ExerciseCommand: {
        templateId: tokenFactoryTemplateId,
        contractId: tokenFactoryContractId,
        choice: "Mint",
        choiceArgument: {
            receiver,
            amount,
        },
    },
});

export interface MintTokenParams {
    tokenFactoryContractId: ContractId;
    receiver: Party;
    amount: number;
}

export async function mintToken(
    userLedger: LedgerController,
    userKeyPair: UserKeyPair,
    params: MintTokenParams
) {
    const mintTokenCommand = getMintTokenCommand(params);

    // TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [mintTokenCommand],
        userKeyPair.privateKey,
        v4()
    );
}
