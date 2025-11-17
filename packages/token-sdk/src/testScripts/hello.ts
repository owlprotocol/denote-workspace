import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdk } from "../wrappedSdk/wrappedSdk.js";

async function hello() {
    const sdk = await getDefaultSdkAndConnect();
    await sdk.connectAdmin();

    const wrappedSdk = getWrappedSdk(sdk);

    const userLedger = sdk.userLedger!;

    // NOTE: this is of course for testing
    const aliceKeyPair = keyPairFromSeed("alice");

    const aliceParty = await userLedger.generateExternalParty(
        aliceKeyPair.publicKey
    );

    if (!aliceParty) {
        throw new Error("Error creating Alice party");
    }

    const aliceSignedHash = signTransactionHash(
        aliceParty.multiHash,
        aliceKeyPair.privateKey
    );

    const aliceAllocatedParty = await userLedger.allocateExternalParty(
        aliceSignedHash,
        aliceParty
    );

    await sdk.setPartyId(aliceAllocatedParty.partyId);

    const instrumentId = aliceAllocatedParty.partyId + "#MyToken";
    const tokenFactoryContractId = await wrappedSdk.tokenFactory.getOrCreate(
        aliceKeyPair,
        instrumentId
    );

    if (!tokenFactoryContractId) {
        throw new Error("Error creating or getting token factory");
    }

    await wrappedSdk.tokenFactory.mintToken(aliceKeyPair, {
        tokenFactoryContractId,
        amount: 1000,
        receiver: aliceAllocatedParty.partyId,
    });
    console.info("Minted 1000 tokens to Alice");

    const tokenBalance = await wrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: { admin: aliceAllocatedParty.partyId, id: instrumentId },
    });

    // Assume there is only one UTXO for simplicity
    const tokenContractId = tokenBalance.utxos[0].contractId;

    console.log({ tokenBalance, tokenContractId });
}

hello()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in main: ", error);
        process.exit(1);
    });
