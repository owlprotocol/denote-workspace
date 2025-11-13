/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */

import {
    LedgerController,
    signTransactionHash,
    WrappedCommand,
} from "@canton-network/wallet-sdk";
import { v4 } from "uuid";

interface TokenFactoryParams {
    issuer: string;
    instrumentId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ContractEntry<ContractParams = Record<string, any>> {
    JsActiveContract: {
        createdEvent: {
            contractId: string;
            templateId: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            createArgument: ContractParams;
        };
    };
}

export async function getBalanceByInstrumentId(
    owner: string,
    instrumentId: string
) {
    // TODO: Implement actual logic
    return 0;
}

// TODO: do not pass userKeyPair here
export async function createTokenFactory(
    userLedger: LedgerController,
    userKeyPair: { publicKey: string; privateKey: string },
    params: {
        tokenFactoryTemplateId: string;
        instrumentId: string;
    }
) {
    const { tokenFactoryTemplateId, instrumentId } = params;

    const issuer = userLedger.getPartyId();
    const createTokenFactoryCommand: WrappedCommand = {
        CreateCommand: {
            templateId: tokenFactoryTemplateId,
            createArguments: {
                issuer,
                instrumentId,
            },
        },
    };

    const prepareTokenFactoryResponse = await userLedger.prepareSubmission(
        createTokenFactoryCommand
    );

    const signedTokenFactoryCommandHash = signTransactionHash(
        prepareTokenFactoryResponse.preparedTransactionHash,
        userKeyPair.privateKey
    );

    await userLedger.executeSubmissionAndWaitFor(
        prepareTokenFactoryResponse,
        signedTokenFactoryCommandHash,
        userKeyPair.publicKey,
        v4()
    );
}

// Assumes owner is also the party
export async function getLatestTokenFactory(
    userLedger: LedgerController,
    params: {
        tokenFactoryTemplateId: string;
        instrumentId: string;
    }
) {
    const { tokenFactoryTemplateId, instrumentId } = params;
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
    params: {
        tokenFactoryTemplateId: string;
        instrumentId: string;
    }
) {
    const contractId = await getLatestTokenFactory(userLedger, params);
    if (contractId) return contractId;

    await createTokenFactory(userLedger, userKeyPair, params);
    return await getLatestTokenFactory(userLedger, params);
}

export async function transferToken(
    to: string,
    amount: number,
    instrumentId: string
) {
    return "submissionId";
}
