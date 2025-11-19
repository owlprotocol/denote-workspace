import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDKImpl,
} from "@canton-network/wallet-sdk";
import fs from "fs/promises";
import path from "path";

const sdk = new WalletSDKImpl().configure({
    logger: console,
    authFactory: localNetAuthDefault,
    ledgerFactory: localNetLedgerDefault,
    tokenStandardFactory: localNetTokenStandardDefault,
});

export async function uploadDars() {
    await sdk.connect();
    await sdk.connectAdmin();
    await sdk.connectTopology(new URL("http://localhost:2000/api/validator"));

    // Obtained from runnning:
    // `pnpm get:minimal-token-id`
    const MINIMAL_TOKEN_PACKAGE_ID =
        "026f8ccc9786e19b203e1687cc4790604ad60a4b9b368ab22e8e9e95587e166f";

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
        console.info("minimal-token DAR already uploaded");
    } else {
        console.info("Uploading DAR file...");
        const darBytes = await fs.readFile(minimalTokenDarPath);
        await sdk.adminLedger!.uploadDar(darBytes);
        console.info("DAR uploaded successfully");
    }
}

uploadDars()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in uploadDars: ", error);
        process.exit(1);
    });
