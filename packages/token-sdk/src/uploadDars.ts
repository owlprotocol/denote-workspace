import fs from "fs/promises";
import path from "path";
import { MINIMAL_TOKEN_PACKAGE_ID } from "./constants/MINIMAL_TOKEN_PACKAGE_ID.js";
import { getDefaultSdkAndConnect } from "./sdkHelpers.js";

export async function uploadDars() {
    const sdk = await getDefaultSdkAndConnect();
    await sdk.connectAdmin();

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
