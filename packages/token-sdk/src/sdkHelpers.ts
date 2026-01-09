import {
    Config,
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
    WalletSDK,
    AuthTokenProvider,
    LedgerController,
    TokenStandardController,
    ValidatorController,
} from "@canton-network/wallet-sdk";
import { get5NAuthController } from "./helpers/get5NAuthController.js";

import dotenv from "dotenv";

dotenv.config();

export const FIVEN_SCAN_PROXY_API_URL = new URL(
    "https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator"
);

export const FIVEN_LEDGER_API_URL = new URL(
    "https://ledger-api.validator.devnet.sandbox.fivenorth.io/"
);

export const FIVEN_VALIDATOR_API_URL = new URL(
    "https://wallet.validator.devnet.sandbox.fivenorth.io/"
);

const USE_5N = process.env.USE_5N === "true";
const CLIENT_ID_5N = process.env.CLIENT_ID_5N ?? "";
const CLIENT_SECRET_5N = process.env.CLIENT_SECRET_5N ?? "";

const defaultSdkConfig: Config = {
    logger: console,
    authFactory: localNetAuthDefault,
    ledgerFactory: localNetLedgerDefault,
    tokenStandardFactory: localNetTokenStandardDefault,
};

const fiveNSdkConfig: Config = {
    logger: console,
    authFactory: () =>
        get5NAuthController({
            clientId: CLIENT_ID_5N,
            clientSecret: CLIENT_SECRET_5N,
        }),
    ledgerFactory: (
        userId: string,
        authTokenProvider: AuthTokenProvider,
        isAdmin = false
    ) =>
        new LedgerController(
            userId,
            FIVEN_LEDGER_API_URL,
            undefined,
            isAdmin,
            authTokenProvider
        ),
    tokenStandardFactory: (
        userId: string,
        authTokenProvider: AuthTokenProvider
    ) =>
        new TokenStandardController(
            userId,
            FIVEN_LEDGER_API_URL,
            FIVEN_VALIDATOR_API_URL,
            undefined,
            authTokenProvider
        ),
    validatorFactory: (userId: string, authTokenProvider: AuthTokenProvider) =>
        new ValidatorController(
            userId,
            FIVEN_VALIDATOR_API_URL,
            authTokenProvider
        ),
};

export const getDefaultSdk = () =>
    new WalletSDKImpl().configure(USE_5N ? fiveNSdkConfig : defaultSdkConfig);

export const LOCALNET_SCAN_PROXY_API_URL = new URL(
    "http://localhost:2000/api/validator"
);

const sdkCache = new Map<string, Promise<WalletSDK>>();

export const getSdkForParty = async (partyId: string): Promise<WalletSDK> => {
    const existingPromise = sdkCache.get(partyId);
    if (existingPromise) {
        return existingPromise;
    }

    const sdkPromise = (async () => {
        const sdk = getDefaultSdk();
        await sdk.connect();
        await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);
        await sdk.setPartyId(partyId);
        return sdk;
    })();

    sdkCache.set(partyId, sdkPromise);

    sdkPromise.catch(() => {
        sdkCache.delete(partyId);
    });

    return sdkPromise;
};

export const getDefaultSdkAndConnect = async () => {
    const sdk = getDefaultSdk();
    await sdk.connect();
    await sdk.connectTopology(
        USE_5N ? FIVEN_SCAN_PROXY_API_URL : LOCALNET_SCAN_PROXY_API_URL
    );
    return sdk;
};
