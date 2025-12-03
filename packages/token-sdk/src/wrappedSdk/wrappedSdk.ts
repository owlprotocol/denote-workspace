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
    getAllBalancesByInstrumentId,
    GetAllBalancesByInstrumentIdParams,
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
    getAllIssuerMintRequests,
    acceptIssuerMintRequest,
    declineIssuerMintRequest,
    withdrawIssuerMintRequest,
    IssuerMintRequestParams,
} from "./issuerMintRequest.js";
import {
    createIssuerBurnRequest,
    getLatestIssuerBurnRequest,
    getAllIssuerBurnRequests,
    acceptIssuerBurnRequest,
    declineIssuerBurnRequest,
    withdrawIssuerBurnRequest,
    IssuerBurnRequestParams,
} from "./issuerBurnRequest.js";
import {
    createTransferRequest,
    getLatestTransferRequest,
    acceptTransferRequest,
    declineTransferRequest,
    withdrawTransferRequest,
    getAllTransferRequests,
    TransferRequestParams,
} from "./transferRequest.js";
import { ContractId, Party } from "../types/daml.js";
import {
    acceptTransferInstruction,
    rejectTransferInstruction,
    TransferInstructionAcceptParams,
} from "./transferInstruction.js";
import { getTransferInstructionDisclosure } from "./disclosure.js";
import { Types } from "@canton-network/core-ledger-client";
import {
    acceptBondIssuerMintRequest,
    BondIssuerMintRequestParams,
    createBondIssuerMintRequest,
    declineBondIssuerMintRequest,
    getAllBondIssuerMintRequests,
    getLatestBondIssuerMintRequest,
    withdrawBondIssuerMintRequest,
} from "./bonds/issuerMintRequest.js";
import {
    createBondLifecycleRule,
    CreateBondLifecycleRuleParams,
    getLatestBondLifecycleRule,
    getOrCreateBondLifecycleRule,
    processCouponPaymentEvent,
    ProcessCouponPaymentEventParams,
    processRedemptionEvent,
    ProcessRedemptionEventParams,
} from "./bonds/lifecycleRule.js";
import {
    createBondFactory,
    getLatestBondFactory,
    getOrCreateBondFactory,
} from "./bonds/factory.js";
import {
    acceptBondLifecycleClaimRequest,
    BondLifecycleClaimRequestParams,
    createBondLifecycleClaimRequest,
    declineBondLifecycleClaimRequest,
    getAllBondLifecycleClaimRequests,
    getLatestBondLifecycleClaimRequest,
    withdrawBondLifecycleClaimRequest,
} from "./bonds/lifecycleClaimRequest.js";

export const getWrappedSdk = (sdk: WalletSDK) => {
    if (!sdk.userLedger) {
        throw new Error("User ledger not initialized");
    }

    const userLedger = sdk.userLedger;

    return {
        bonds: {
            factory: {
                create: (userKeyPair: UserKeyPair, instrumentId: string) =>
                    createBondFactory(userLedger, userKeyPair, instrumentId),
                getLatest: (instrumentId: string) =>
                    getLatestBondFactory(userLedger, instrumentId),
                getOrCreate: (userKeyPair: UserKeyPair, instrumentId: string) =>
                    getOrCreateBondFactory(
                        userLedger,
                        userKeyPair,
                        instrumentId
                    ),
            },
            issuerMintRequest: {
                create: (
                    userKeyPair: UserKeyPair,
                    params: BondIssuerMintRequestParams
                ) =>
                    createBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                getLatest: (issuer: Party) =>
                    getLatestBondIssuerMintRequest(userLedger, issuer),
                getAll: (issuer: Party) =>
                    getAllBondIssuerMintRequests(userLedger, issuer),
                accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    acceptBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    declineBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    withdrawBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
            },
            lifecycleRule: {
                create: (
                    userKeyPair: UserKeyPair,
                    params: CreateBondLifecycleRuleParams
                ) => createBondLifecycleRule(userLedger, userKeyPair, params),
                getLatest: (params: CreateBondLifecycleRuleParams) =>
                    getLatestBondLifecycleRule(userLedger, params),
                getOrCreate: (
                    userKeyPair: UserKeyPair,
                    params: CreateBondLifecycleRuleParams
                ) =>
                    getOrCreateBondLifecycleRule(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                processCouponPaymentEvent: (
                    userKeyPair: UserKeyPair,
                    contractId: ContractId,
                    params: ProcessCouponPaymentEventParams
                ) =>
                    processCouponPaymentEvent(
                        userLedger,
                        userKeyPair,
                        contractId,
                        params
                    ),
                processRedemptionEvent: (
                    userKeyPair: UserKeyPair,
                    contractId: ContractId,
                    params: ProcessRedemptionEventParams
                ) =>
                    processRedemptionEvent(
                        userLedger,
                        userKeyPair,
                        contractId,
                        params
                    ),
            },
            lifecycleClaimRequest: {
                create: (
                    userKeyPair: UserKeyPair,
                    params: BondLifecycleClaimRequestParams
                ) =>
                    createBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                getLatest: (issuer: Party) =>
                    getLatestBondLifecycleClaimRequest(userLedger, issuer),
                getAll: (issuer: Party) =>
                    getAllBondLifecycleClaimRequests(userLedger, issuer),
                accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    acceptBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    declineBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                    withdrawBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
            },
        },
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
            getAllByInstrumentId: (
                params: GetAllBalancesByInstrumentIdParams
            ) => getAllBalancesByInstrumentId(sdk, params),
        },
        issuerMintRequest: {
            create: (
                userKeyPair: UserKeyPair,
                params: IssuerMintRequestParams
            ) => createIssuerMintRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerMintRequest(userLedger, issuer),
            getAll: (issuer: Party) =>
                getAllIssuerMintRequests(userLedger, issuer),
            accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                acceptIssuerMintRequest(userLedger, userKeyPair, contractId),
            decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                declineIssuerMintRequest(userLedger, userKeyPair, contractId),
            withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                withdrawIssuerMintRequest(userLedger, userKeyPair, contractId),
        },
        issuerBurnRequest: {
            create: (
                userKeyPair: UserKeyPair,
                params: IssuerBurnRequestParams
            ) => createIssuerBurnRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerBurnRequest(userLedger, issuer),
            getAll: (issuer: Party) =>
                getAllIssuerBurnRequests(userLedger, issuer),
            accept: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                acceptIssuerBurnRequest(userLedger, userKeyPair, contractId),
            decline: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                declineIssuerBurnRequest(userLedger, userKeyPair, contractId),
            withdraw: (userKeyPair: UserKeyPair, contractId: ContractId) =>
                withdrawIssuerBurnRequest(userLedger, userKeyPair, contractId),
        },
        transferRequest: {
            create: (userKeyPair: UserKeyPair, params: TransferRequestParams) =>
                createTransferRequest(userLedger, userKeyPair, params),
            getLatest: (expectedAdmin: Party) =>
                getLatestTransferRequest(userLedger, expectedAdmin),
            getAll: (expectedAdmin: Party) =>
                getAllTransferRequests(userLedger, expectedAdmin),
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
            getDisclosure: (contractId: ContractId) =>
                getTransferInstructionDisclosure(userLedger, contractId),
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
            reject: (
                userKeyPair: UserKeyPair,
                contractId: ContractId,
                disclosedContracts?: Types["DisclosedContract"][],
                params?: TransferInstructionAcceptParams
            ) =>
                rejectTransferInstruction(
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
        bonds: {
            factory: {
                create: (instrumentId: string) =>
                    createBondFactory(userLedger, userKeyPair, instrumentId),
                getLatest: (instrumentId: string) =>
                    getLatestBondFactory(userLedger, instrumentId),
                getOrCreate: (instrumentId: string) =>
                    getOrCreateBondFactory(
                        userLedger,
                        userKeyPair,
                        instrumentId
                    ),
            },
            issuerMintRequest: {
                create: (params: BondIssuerMintRequestParams) =>
                    createBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                getLatest: (issuer: Party) =>
                    getLatestBondIssuerMintRequest(userLedger, issuer),
                getAll: (issuer: Party) =>
                    getAllBondIssuerMintRequests(userLedger, issuer),
                accept: (contractId: ContractId) =>
                    acceptBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                decline: (contractId: ContractId) =>
                    declineBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                withdraw: (contractId: ContractId) =>
                    withdrawBondIssuerMintRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
            },
            lifecycleRule: {
                create: (params: CreateBondLifecycleRuleParams) =>
                    createBondLifecycleRule(userLedger, userKeyPair, params),
                getLatest: (params: CreateBondLifecycleRuleParams) =>
                    getLatestBondLifecycleRule(userLedger, params),
                getOrCreate: (params: CreateBondLifecycleRuleParams) =>
                    getOrCreateBondLifecycleRule(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                processCouponPaymentEvent: (
                    contractId: ContractId,
                    params: ProcessCouponPaymentEventParams
                ) =>
                    processCouponPaymentEvent(
                        userLedger,
                        userKeyPair,
                        contractId,
                        params
                    ),
                processRedemptionEvent: (
                    contractId: ContractId,
                    params: ProcessRedemptionEventParams
                ) =>
                    processRedemptionEvent(
                        userLedger,
                        userKeyPair,
                        contractId,
                        params
                    ),
            },
            lifecycleClaimRequest: {
                create: (params: BondLifecycleClaimRequestParams) =>
                    createBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        params
                    ),
                getLatest: (issuer: Party) =>
                    getLatestBondLifecycleClaimRequest(userLedger, issuer),
                getAll: (issuer: Party) =>
                    getAllBondLifecycleClaimRequests(userLedger, issuer),
                accept: (contractId: ContractId) =>
                    acceptBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                decline: (contractId: ContractId) =>
                    declineBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
                withdraw: (contractId: ContractId) =>
                    withdrawBondLifecycleClaimRequest(
                        userLedger,
                        userKeyPair,
                        contractId
                    ),
            },
        },
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
            getAllByInstrumentId: (
                params: GetAllBalancesByInstrumentIdParams
            ) => getAllBalancesByInstrumentId(sdk, params),
        },
        issuerMintRequest: {
            create: (params: IssuerMintRequestParams) =>
                createIssuerMintRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerMintRequest(userLedger, issuer),
            getAll: (issuer: Party) =>
                getAllIssuerMintRequests(userLedger, issuer),
            accept: (contractId: ContractId) =>
                acceptIssuerMintRequest(userLedger, userKeyPair, contractId),
            decline: (contractId: ContractId) =>
                declineIssuerMintRequest(userLedger, userKeyPair, contractId),
            withdraw: (contractId: ContractId) =>
                withdrawIssuerMintRequest(userLedger, userKeyPair, contractId),
        },
        issuerBurnRequest: {
            create: (params: IssuerBurnRequestParams) =>
                createIssuerBurnRequest(userLedger, userKeyPair, params),
            getLatest: (issuer: Party) =>
                getLatestIssuerBurnRequest(userLedger, issuer),
            getAll: (issuer: Party) =>
                getAllIssuerBurnRequests(userLedger, issuer),
            accept: (contractId: ContractId) =>
                acceptIssuerBurnRequest(userLedger, userKeyPair, contractId),
            decline: (contractId: ContractId) =>
                declineIssuerBurnRequest(userLedger, userKeyPair, contractId),
            withdraw: (contractId: ContractId) =>
                withdrawIssuerBurnRequest(userLedger, userKeyPair, contractId),
        },
        transferRequest: {
            create: (params: TransferRequestParams) =>
                createTransferRequest(userLedger, userKeyPair, params),
            getLatest: (expectedAdmin: Party) =>
                getLatestTransferRequest(userLedger, expectedAdmin),
            getAll: (expectedAdmin: Party) =>
                getAllTransferRequests(userLedger, expectedAdmin),
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
            getDisclosure: (contractId: ContractId) =>
                getTransferInstructionDisclosure(userLedger, contractId),
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
            reject: (
                contractId: ContractId,
                disclosedContracts?: Types["DisclosedContract"][],
                params?: TransferInstructionAcceptParams
            ) =>
                rejectTransferInstruction(
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
