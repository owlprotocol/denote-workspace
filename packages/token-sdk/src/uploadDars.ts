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
await sdk.connectAdmin();
await sdk.connectTopology(new URL("http://localhost:2000/api/validator"));

// Obtained from runnning:
// `daml damlc inspect ../minimal-token/.daml/dist/minimal-token-0.1.0.dar | head -1 | awk '{print $2}'`
const MINIMAL_TOKEN_PACKAGE_ID =
    "425048c2fd2ee20ce31d06a09ba465a5223832b40bdd248f8397f9c911b14dca";

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

if (isDarUploaded) {
    logger.info("minimal-token DAR already uploaded");
} else {
    logger.info("Uploading DAR file...");
    const darBytes = await fs.readFile(minimalTokenDarPath);
    await sdk.adminLedger!.uploadDar(darBytes);
    logger.info("DAR uploaded successfully");
}
