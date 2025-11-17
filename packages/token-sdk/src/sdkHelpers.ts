import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
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

export const getDefaultSdkAndConnect = async () => {
    const sdk = getDefaultSdk();
    await sdk.connect();
    // await sdk.connectTopology(localNetStaticConfig.LOCALNET_SCAN_PROXY_API_URL);
    await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);
    return sdk;
};
