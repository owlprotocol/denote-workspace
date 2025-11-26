import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
    WalletSDK,
} from "@canton-network/wallet-sdk";

export const getDefaultSdk = () =>
    new WalletSDKImpl().configure({
        logger: console,
        authFactory: localNetAuthDefault,
        ledgerFactory: localNetLedgerDefault,
        tokenStandardFactory: localNetTokenStandardDefault,
    });

const LOCALNET_SCAN_PROXY_API_URL = new URL(
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
    // await sdk.connectTopology(localNetStaticConfig.LOCALNET_SCAN_PROXY_API_URL);
    await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);
    return sdk;
};
