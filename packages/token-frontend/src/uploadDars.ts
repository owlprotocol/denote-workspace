import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
} from "@canton-network/wallet-sdk";
import fs from "fs/promises";
import path from "path";
import { pino } from "pino";

const logger = pino({ name: "token-frontend", level: "info" });

const sdk = new WalletSDKImpl().configure({
    logger,
    authFactory: localNetAuthDefault,
    ledgerFactory: localNetLedgerDefault,
    tokenStandardFactory: localNetTokenStandardDefault,
});

// const client = createClient<paths>({
//     baseUrl: "http://localhost:7575/",
// });
//
// const parties = (await client.GET("/v2/parties")).data;
// console.log({ parties });

await sdk.connect();

logger.info("Connecting to topology");
// await sdk.connectTopology(localNetStaticConfig.LOCALNET_SCAN_PROXY_API_URL);
const LOCALNET_SCAN_PROXY_API_URL = new URL(
    "http://localhost:2000/api/validator"
);
await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);

const MINIMAL_TOKEN_PACKAGE_ID =
    "2d5f60afc9d560477b3c73016703e0ecedfcea5d6402586fbb572944e3d3a6db";

const isDarUploaded = await sdk.userLedger?.isPackageUploaded(
    MINIMAL_TOKEN_PACKAGE_ID
);

const minimalTokenDarPath = path.join(
    path.dirname(process.cwd()),
    "minimal-token",
    ".daml",
    "dist",
    "minimal-token-0.1.0.dar"
);

logger.info({ isDarUploaded }, "Status of minimal-token dar upload");

if (!isDarUploaded) {
    try {
        const darBytes = await fs.readFile(minimalTokenDarPath);
        const response = await sdk.adminLedger?.uploadDar(darBytes);
        console.log({ response });
        logger.info(
            "minimal-token DAR ensured on participant (uploaded or already present)"
        );
    } catch (e) {
        logger.error(
            { e, minimalTokenDarPath },
            "Failed to ensure minimal-token DAR uploaded"
        );
        throw e;
    }
}
