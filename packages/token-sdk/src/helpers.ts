import { Holding, PrettyContract } from "@canton-network/core-ledger-client";
import {
    LedgerController,
    WalletSDK,
    WrappedCommand,
} from "@canton-network/wallet-sdk";
import { v4 } from "uuid";

interface TokenFactoryParams {
    issuer: string;
    instrumentId: string;
}

export const tokenFactoryTemplateId =
    "#minimal-token:MyTokenFactory:MyTokenFactory";
export const tokenTemplateId = "#minimal-token:MyToken:MyToken";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ContractEntry<ContractParams = Record<string, any>> {
    JsActiveContract: {
        createdEvent: {
            contractId: string;
            templateId: string;
            createArgument: ContractParams;
        };
    };
}

interface InstrumentId {
    admin: string;
    id: string;
}

export const formatHoldingUtxo = (utxo: PrettyContract<Holding>) => {
    const { amount, owner, instrumentId } = utxo.interfaceViewValue;
    return {
        amount,
        owner,
        instrumentId,
        contractId: utxo.contractId,
    };
};

const instrumentIdToString = (instrumentId: InstrumentId) =>
    `${instrumentId.admin}:${instrumentId.id}`;

const getCreateTokenFactoryCommand = ({
    instrumentId,
    issuer,
}: {
    instrumentId: string;
    issuer: string;
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
    userKeyPair: { publicKey: string; privateKey: string },
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
    const activeContracts = await userLedger.activeContracts({
        offset: end.offset,
        filterByParty: true,
        parties: [issuer],
        templateIds: [tokenFactoryTemplateId],
    });

    if (!activeContracts || activeContracts.length === 0) {
        return;
    }

    const contractEntries = activeContracts.map(
        (entry) => entry.contractEntry as ContractEntry<TokenFactoryParams>
    );
    const filteredEntries = contractEntries.filter(
        (entry) =>
            entry.JsActiveContract.createdEvent.createArgument.instrumentId ===
                instrumentId &&
            entry.JsActiveContract.createdEvent.createArgument.issuer === issuer
    );

    if (filteredEntries.length === 0) {
        return;
    }
    const contractEntry = filteredEntries[filteredEntries.length - 1];

    return contractEntry.JsActiveContract.createdEvent.contractId;
}

export async function getOrCreateTokenFactory(
    userLedger: LedgerController,
    userKeyPair: { publicKey: string; privateKey: string },
    instrumentId: string
) {
    const contractId = await getLatestTokenFactory(userLedger, instrumentId);
    if (contractId) return contractId;

    await createTokenFactory(userLedger, userKeyPair, instrumentId);
    return await getLatestTokenFactory(userLedger, instrumentId);
}

export const getMintTokenCommand = ({
    tokenFactoryContractId,
    receiver,
    amount,
}: {
    tokenFactoryContractId: string;
    receiver: string;
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

export async function mintToken(
    userLedger: LedgerController,
    userKeyPair: { publicKey: string; privateKey: string },
    params: {
        tokenFactoryContractId: string;
        receiver: string;
        amount: number;
    }
) {
    const mintTokenCommand = getMintTokenCommand(params);

    // TODO: can we get a contractId directly from here?
    await userLedger.prepareSignExecuteAndWaitFor(
        [mintTokenCommand],
        userKeyPair.privateKey,
        v4()
    );
}

export async function getBalances(
    sdk: WalletSDK,
    { owner }: { owner: string }
): Promise<
    Record<
        string,
        {
            total: number;
            utxos: { amount: number; contractId: string }[];
        }
    >
> {
    if (!sdk.tokenStandard) {
        throw new Error("Token standard SDK not initialized");
    }
    const tokenStandardPartyId = sdk.tokenStandard.getPartyId();

    try {
        await sdk.setPartyId(owner);
        const utxosUnformatted = await sdk.tokenStandard.listHoldingUtxos(
            false
        );
        const utxos = utxosUnformatted.map(formatHoldingUtxo);
        const balances: Record<
            string,
            {
                total: number;
                utxos: { amount: number; contractId: string }[];
            }
        > = {};
        utxos.forEach((utxo) => {
            console.log({ instrumentId: utxo.instrumentId });
            const instrumentId = instrumentIdToString(utxo.instrumentId);
            if (!balances[instrumentId]) {
                balances[instrumentId] = { total: 0, utxos: [] };
            }

            const amount = Number(utxo.amount);

            balances[instrumentId].total += amount;
            balances[instrumentId].utxos.push({
                amount,
                contractId: utxo.contractId,
            });
        });
        return balances;
    } finally {
        // Try to reset party ID back to token standard party
        await sdk.setPartyId(tokenStandardPartyId);
    }
}

export async function getBalanceByInstrumentId(
    sdk: WalletSDK,
    {
        owner,
        instrumentId,
    }: { owner: string; instrumentId: { admin: string; id: string } }
): Promise<{
    total: number;
    utxos: { amount: number; contractId: string }[];
}> {
    const balances = await getBalances(sdk, { owner });
    const instrumentIdStr = instrumentIdToString(instrumentId);
    return balances[instrumentIdStr] ?? { total: 0, utxos: [] };
}

export const getTransferTokenCommand = ({
    tokenContractId,
    newOwner,
    amount,
}: {
    tokenContractId: string;
    newOwner: string;
    amount: number;
}): WrappedCommand => ({
    ExerciseCommand: {
        templateId: tokenTemplateId,
        choice: "Transfer",
        contractId: tokenContractId,
        choiceArgument: {
            newOwner,
            amount,
        },
    },
});

export async function transferToken(
    userLedger: LedgerController,
    userKeyPair: { publicKey: string; privateKey: string },
    params: {
        tokenContractId: string;
        newOwner: string;
        amount: number;
    }
) {
    const transferTokenCommand = getTransferTokenCommand(params);

    await userLedger.prepareSignExecuteAndWaitFor(
        [transferTokenCommand],
        userKeyPair.privateKey,
        v4()
    );
}
