import { getDefaultSdkAndConnect } from "../sdkHelpers.js";

const PRIMARY_PARTY_ID = process.env.PRIMARY_PARTY_ID;

async function createUsers() {
    if (!PRIMARY_PARTY_ID) {
        throw new Error("PRIMARY_PARTY_ID is not set in environment variables");
    }

    const sdk = await getDefaultSdkAndConnect();
    await sdk.connectAdmin();
    const adminLedger = sdk.adminLedger!;

    const userAlice = await adminLedger.createUser(
        "minimal-token-alice",
        PRIMARY_PARTY_ID
    );

    const userBob = await adminLedger.createUser(
        "minimal-token-bob",
        PRIMARY_PARTY_ID
    );

    const userCharlie = await adminLedger.createUser(
        "minimal-token-charlie",
        PRIMARY_PARTY_ID
    );

    console.log({ userAlice, userBob, userCharlie });
}

createUsers()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in createUsers: ", error);
        process.exit(1);
    });
