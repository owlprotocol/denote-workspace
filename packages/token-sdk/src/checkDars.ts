import { MINIMAL_TOKEN_PACKAGE_ID } from "./constants/MINIMAL_TOKEN_PACKAGE_ID.js";
import { FIVEN_SCAN_PROXY_API_URL, getDefaultSdk } from "./sdkHelpers.js";

export async function checkDars() {
    const sdk = getDefaultSdk();

    await sdk.connect();
    await sdk.connectTopology(FIVEN_SCAN_PROXY_API_URL);

    const isDarUploaded = await sdk.userLedger?.isPackageUploaded(
        MINIMAL_TOKEN_PACKAGE_ID
    );

    if (isDarUploaded) {
        console.info("minimal-token DAR already uploaded");
    } else {
        console.info("minimal-token DAR not uploaded");
    }
}

checkDars()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in checkDars: ", error);
        process.exit(1);
    });
