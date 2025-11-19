import { WalletSDK } from "@canton-network/wallet-sdk";
import { UserKeyPair } from "../types/UserKeyPair.js";
import { getSdkForParty } from "../sdkHelpers.js";
import {
    createTokenFactory,
    getLatestTokenFactory,
    getOrCreateTokenFactory,
    mintToken,
    MintTokenParams,
} from "./tokenFactory.js";
import {
    createTokenRules,
    getLatestTokenRules,
    getOrCreateTokenRules,
} from "./tokenRules.js";
import {
    createTransferFactory,
    getLatestTransferFactory,
    getOrCreateTransferFactory,
} from "./transferFactory.js";
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
import {
    createIssuerMintRequest,
    getLatestIssuerMintRequest,
    acceptIssuerMintRequest,
    declineIssuerMintRequest,
    withdrawIssuerMintRequest,
    IssuerMintRequestParams,
} from "./issuerMintRequest.js";
import {
    createTransferRequest,
    getLatestTransferRequest,
    acceptTransferRequest,
    declineTransferRequest,
    withdrawTransferRequest,
    TransferRequestParams,
} from "./transferRequest.js";
import { ContractId, Party } from "../types/daml.js";
import {
    acceptTransferInstruction,
    TransferInstructionAcceptParams,
} from "./transferInstruction.js";
import { Types } from "@canton-network/core-ledger-client";

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
        tokenRules: {
            create: (userKeyPair: UserKeyPair) =>
                createTokenRules(userLedger, userKeyPair),
            getLatest: () => getLatestTokenRules(userLedger),
            getOrCreate: (userKeyPair: UserKeyPair) =>
                getOrCreateTokenRules(userLedger, userKeyPair),
        },
        transferFactory: {
            create: (userKeyPair: UserKeyPair, rulesCid: ContractId) =>
                createTransferFactory(userLedger, userKeyPair, rulesCid),
            getLatest: (rulesCid: ContractId) =>
                getLatestTransferFactory(userLedger, rulesCid),
            getOrCreate: (userKeyPair: UserKeyPair, rulesCid: ContractId) =>
                getOrCreateTransferFactory(userLedger, userKeyPair, rulesCid),
        },
        balances: {
            get: (owner: Party) => getBalances(sdk, owner),
            getByInstrumentId: (params: GetBalanceByInstrumentIdParams) =>
                getBalanceByInstrumentId(sdk, params),
        },
        issuerMintRequest: {
            create: (
                userKeyPair: UserKeyPair,
                params: IssuerMintRequestParams
            ) => createIssuerMintRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerMintRequest(userLedger, issuer),
            accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                acceptIssuerMintRequest(userLedger, userKeyPair, contractId),
            decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                declineIssuerMintRequest(userLedger, userKeyPair, contractId),
            withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                withdrawIssuerMintRequest(userLedger, userKeyPair, contractId),
        },
        transferRequest: {
            create: (userKeyPair: UserKeyPair, params: TransferRequestParams) =>
                createTransferRequest(userLedger, userKeyPair, params),
            getLatest: (expectedAdmin: Party) =>
                getLatestTransferRequest(userLedger, expectedAdmin),
            accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                acceptTransferRequest(userLedger, userKeyPair, contractId),
            decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                declineTransferRequest(userLedger, userKeyPair, contractId),
            withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                withdrawTransferRequest(userLedger, userKeyPair, contractId),
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
        transferInstruction: {
            accept: (
                userKeyPair: UserKeyPair,
                contractId: ContractId,
                disclosedContracts?: Types["DisclosedContract"][],
                params?: TransferInstructionAcceptParams
            ) =>
                acceptTransferInstruction(
                    userLedger,
                    userKeyPair,
                    contractId,
                    disclosedContracts,
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
        tokenRules: {
            create: () => createTokenRules(userLedger, userKeyPair),
            getLatest: () => getLatestTokenRules(userLedger),
            getOrCreate: () => getOrCreateTokenRules(userLedger, userKeyPair),
        },
        transferFactory: {
            create: (rulesCid: ContractId) =>
                createTransferFactory(userLedger, userKeyPair, rulesCid),
            getLatest: (rulesCid: ContractId) =>
                getLatestTransferFactory(userLedger, rulesCid),
            getOrCreate: (rulesCid: ContractId) =>
                getOrCreateTransferFactory(userLedger, userKeyPair, rulesCid),
        },
        balances: {
            get: (owner: Party) => getBalances(sdk, owner),
            getByInstrumentId: (params: GetBalanceByInstrumentIdParams) =>
                getBalanceByInstrumentId(sdk, params),
        },
        issuerMintRequest: {
            create: (params: IssuerMintRequestParams) =>
                createIssuerMintRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerMintRequest(userLedger, issuer),
            accept: (contractId: ContractId) =>
                acceptIssuerMintRequest(userLedger, userKeyPair, contractId),
            decline: (contractId: ContractId) =>
                declineIssuerMintRequest(userLedger, userKeyPair, contractId),
            withdraw: (contractId: ContractId) =>
                withdrawIssuerMintRequest(userLedger, userKeyPair, contractId),
        },
        transferRequest: {
            create: (params: TransferRequestParams) =>
                createTransferRequest(userLedger, userKeyPair, params),
            getLatest: (expectedAdmin: Party) =>
                getLatestTransferRequest(userLedger, expectedAdmin),
            accept: (contractId: ContractId) =>
                acceptTransferRequest(userLedger, userKeyPair, contractId),
            decline: (contractId: ContractId) =>
                declineTransferRequest(userLedger, userKeyPair, contractId),
            withdraw: (contractId: ContractId) =>
                withdrawTransferRequest(userLedger, userKeyPair, contractId),
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
        transferInstruction: {
            accept: (
                contractId: ContractId,
                disclosedContracts?: Types["DisclosedContract"][],
                params?: TransferInstructionAcceptParams
            ) =>
                acceptTransferInstruction(
                    userLedger,
                    userKeyPair,
                    contractId,
                    disclosedContracts,
                    params
                ),
        },
    };
};

export const getWrappedSdkForParty = async (partyId: string) => {
    const sdk = await getSdkForParty(partyId);
    return getWrappedSdk(sdk);
};

export const getWrappedSdkWithKeyPairForParty = async (
    partyId: string,
    userKeyPair: UserKeyPair
) => {
    const sdk = await getSdkForParty(partyId);
    return getWrappedSdkWithKeyPair(sdk, userKeyPair);
};
