import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    WalletSDK,
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

// Obtained from runnning:
// `pnpm get:minimal-token-id`
const MINIMAL_TOKEN_PACKAGE_ID =
    "68c1b4981314149b66cb3c75f1d63e4111516075564d884f3a19a3b753416e22";

// Obtained from runnning:
// `pnpm get:daml-finance-id`
const DAML_FINANCE_PACKAGE_ID =
    "83019256c9f372abecea457a3bb2a59463bf06d4ff832fa6bba7073c216f33cb";

async function uploadDar({
    packageId,
    packagePath,
    sdk,
}: {
    packageId: string;
    packagePath: string;
    sdk: WalletSDK;
}) {
    const isDarUploaded = await sdk.userLedger!.isPackageUploaded(packageId);

    if (isDarUploaded) {
        console.info("minimal-token DAR already uploaded");
    } else {
        console.info("Uploading DAR file...");
        const darBytes = await fs.readFile(packagePath);
        await sdk.adminLedger!.uploadDar(darBytes);
        console.info("DAR uploaded successfully");
    }
}

export async function uploadDars() {
    await sdk.connect();
    await sdk.connectAdmin();
    await sdk.connectTopology(new URL("http://localhost:2000/api/validator"));

    const curDirectory = path.dirname(process.cwd());
    const minimalTokenDarPath = path.join(
        curDirectory,
        "minimal-token",
        ".daml",
        "dist",
        "minimal-token-0.1.0.dar"
    );

    console.log({ minimalTokenDarPath });

    await uploadDar({
        packageId: MINIMAL_TOKEN_PACKAGE_ID,
        packagePath: minimalTokenDarPath,
        sdk,
    });

    const parentDir = path.dirname(curDirectory);
    const damlFinanceDarPath = path.join(
        parentDir,
        "daml",
        "daml-finance",
        ".daml",
        "dist",
        "daml-finance-1.6.1.dar"
    );
    console.log({ damlFinanceDarPath });

    await uploadDar({
        packageId: DAML_FINANCE_PACKAGE_ID,
        packagePath: damlFinanceDarPath,
        sdk,
    });
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
