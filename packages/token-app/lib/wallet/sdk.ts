import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
    WalletSDK,
} from "@canton-network/wallet-sdk";
import fs from "fs/promises";
import path from "path";
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

const MINIMAL_TOKEN_PACKAGE_ID =
    "b0b308fa753904d794fc09ff61e8b2dd8a2398bb97fa98a604d294f75a13bc8b";

// TODO: temporary helper, remove
async function ensureMinimalTokenDarUploaded(sdk: WalletSDK): Promise<void> {
    if (!sdk.adminLedger || !sdk.userLedger) {
        throw new Error("SDK must be connected before uploading DAR");
    }

    const isUploaded = await sdk.userLedger.isPackageUploaded(
        MINIMAL_TOKEN_PACKAGE_ID
    );

    if (isUploaded) {
        logger.info("minimal-token DAR already uploaded");
        return;
    }

    const minimalTokenDarPath = path.join(
        process.cwd(),
        "..",
        "minimal-token",
        ".daml",
        "dist",
        "minimal-token-0.1.0.dar"
    );

    try {
        const darBytes = await fs.readFile(minimalTokenDarPath);
        await sdk.adminLedger.uploadDar(darBytes);
    } catch (error) {
        if (error instanceof Error && error.message.includes("ENOENT")) {
            throw new Error(
                `DAR file not found at ${minimalTokenDarPath}. Please build the minimal-token package first with 'daml build' in the minimal-token directory.`
            );
        }
        throw error;
    }
}

export const initializeSDK = async (sdk: WalletSDK): Promise<void> => {
    await sdk.connect();

    await sdk.connectAdmin();

    const LOCALNET_SCAN_PROXY_API_URL = new URL(
        "http://localhost:2000/api/validator"
    );
    await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);

    await ensureMinimalTokenDarUploaded(sdk);

    logger.info("SDK initialized successfully");

    if (!sdk.userLedger) {
        throw new Error("userLedger is not available after initialization");
    }

    if (!sdk.topology) {
        throw new Error("topology is not available after initialization");
    }
};
