import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
    WalletSDK,
} from "@canton-network/wallet-sdk";
import { pino } from "pino";

export const logger = pino({ name: "token-app", level: "info" });

export const createWalletSDK = (): WalletSDK => {
    return new WalletSDKImpl().configure({
        logger,
        authFactory: localNetAuthDefault,
        ledgerFactory: localNetLedgerDefault,
        tokenStandardFactory: localNetTokenStandardDefault,
    });
};

export const initializeSDK = async (sdk: WalletSDK): Promise<void> => {
    await sdk.connect();

    await sdk.connectAdmin();

    const LOCALNET_SCAN_PROXY_API_URL = new URL(
        "http://localhost:2000/api/validator"
    );
    await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);

    logger.info("SDK initialized successfully");

    if (!sdk.userLedger) {
        throw new Error("userLedger is not available after initialization");
    }

    if (!sdk.topology) {
        throw new Error("topology is not available after initialization");
    }
};
