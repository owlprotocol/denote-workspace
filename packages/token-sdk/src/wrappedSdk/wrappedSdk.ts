import { WalletSDK } from "@canton-network/wallet-sdk";
import { UserKeyPair } from "../types/UserKeyPair.js";
import {
    createTokenFactory,
    getLatestTokenFactory,
    getOrCreateTokenFactory,
    mintToken,
    MintTokenParams,
} from "./tokenFactory.js";
import {
    getBalanceByInstrumentId,
    GetBalanceByInstrumentIdParams,
    getBalances,
} from "./balances.js";
import {
    createTransferPreapprovalProposal,
    CreateTransferPreapprovalProposalParams,
    getLatestTransferPreapprovalProposal,
    getOrCreateTransferPreapprovalProposal,
    transferPreapprovalProposalAccept,
    TransferPreapprovalProposalAcceptParams,
    TransferPreapprovalProposalParams,
} from "./transferPreapprovalProposal.js";
import {
    getLatestTransferPreapproval,
    TransferPreapprovalParams,
    transferPreapprovalSend,
    TransferPreapprovalSendParams,
} from "./transferPreapproval.js";
import { ContractId, Party } from "../types/daml.js";

export const getWrappedSdk = (sdk: WalletSDK) => {
    if (!sdk.userLedger) {
        throw new Error("User ledger not initialized");
    }

    const userLedger = sdk.userLedger;

    return {
        tokenFactory: {
            create: (userKeyPair: UserKeyPair, instrumentId: string) =>
                createTokenFactory(userLedger, userKeyPair, instrumentId),
            getLatest: (instrumentId: string) =>
                getLatestTokenFactory(userLedger, instrumentId),
            getOrCreate: (userKeyPair: UserKeyPair, instrumentId: string) =>
                getOrCreateTokenFactory(userLedger, userKeyPair, instrumentId),
            mintToken: (
                userKeyPair: UserKeyPair,
                contractId: ContractId,
                params: MintTokenParams
            ) => mintToken(userLedger, userKeyPair, contractId, params),
        },
        balances: {
            get: (owner: Party) => getBalances(sdk, owner),
            getByInstrumentId: (params: GetBalanceByInstrumentIdParams) =>
                getBalanceByInstrumentId(sdk, params),
        },
        transferPreapprovalProposal: {
            create: (
                userKeyPair: UserKeyPair,
                params: CreateTransferPreapprovalProposalParams
            ) =>
                createTransferPreapprovalProposal(
                    userLedger,
                    userKeyPair,
                    params
                ),
            getLatest: (params: TransferPreapprovalProposalParams) =>
                getLatestTransferPreapprovalProposal(userLedger, params),
            getOrCreate: (
                userKeyPair: UserKeyPair,
                params: CreateTransferPreapprovalProposalParams
            ) =>
                getOrCreateTransferPreapprovalProposal(
                    userLedger,
                    userKeyPair,
                    params
                ),
            accept: (
                userKeyPair: UserKeyPair,
                params: TransferPreapprovalProposalAcceptParams
            ) =>
                transferPreapprovalProposalAccept(
                    userLedger,
                    userKeyPair,
                    params
                ),
        },
        transferPreapproval: {
            getLatest: (params: TransferPreapprovalParams) =>
                getLatestTransferPreapproval(userLedger, params),
            send: (
                userKeyPair: UserKeyPair,
                contractId: ContractId,
                params: TransferPreapprovalSendParams
            ) =>
                transferPreapprovalSend(
                    userLedger,
                    userKeyPair,
                    contractId,
                    params
                ),
        },
    };
};

export const getWrappedSdkWithKeyPair = (
    sdk: WalletSDK,
    userKeyPair: UserKeyPair
) => {
    if (!sdk.userLedger) {
        throw new Error("User ledger not initialized");
    }

    const userLedger = sdk.userLedger;

    return {
        tokenFactory: {
            create: (instrumentId: string) =>
                createTokenFactory(userLedger, userKeyPair, instrumentId),
            getLatest: (instrumentId: string) =>
                getLatestTokenFactory(userLedger, instrumentId),
            getOrCreate: (instrumentId: string) =>
                getOrCreateTokenFactory(userLedger, userKeyPair, instrumentId),
            mintToken: (contractId: ContractId, params: MintTokenParams) =>
                mintToken(userLedger, userKeyPair, contractId, params),
        },
        balances: {
            get: (owner: Party) => getBalances(sdk, owner),
            getByInstrumentId: (params: GetBalanceByInstrumentIdParams) =>
                getBalanceByInstrumentId(sdk, params),
        },
        transferPreapprovalProposal: {
            create: (params: CreateTransferPreapprovalProposalParams) =>
                createTransferPreapprovalProposal(
                    userLedger,
                    userKeyPair,
                    params
                ),
            getLatest: (params: TransferPreapprovalProposalParams) =>
                getLatestTransferPreapprovalProposal(userLedger, params),
            getOrCreate: (params: CreateTransferPreapprovalProposalParams) =>
                getOrCreateTransferPreapprovalProposal(
                    userLedger,
                    userKeyPair,
                    params
                ),
            accept: (params: TransferPreapprovalProposalAcceptParams) =>
                transferPreapprovalProposalAccept(
                    userLedger,
                    userKeyPair,
                    params
                ),
        },
        transferPreapproval: {
            getLatest: (params: TransferPreapprovalParams) =>
                getLatestTransferPreapproval(userLedger, params),
            send: (
                contractId: ContractId,
                params: TransferPreapprovalSendParams
            ) =>
                transferPreapprovalSend(
                    userLedger,
                    userKeyPair,
                    contractId,
                    params
                ),
        },
    };
};
