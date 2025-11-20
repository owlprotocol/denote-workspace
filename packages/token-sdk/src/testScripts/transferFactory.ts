import { signTransactionHash } from "@canton-network/wallet-sdk";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";

async function transferFactory() {
    const sdk = await getDefaultSdkAndConnect();
    await sdk.connectAdmin();

    // NOTE: this is of course for testing
    const aliceKeyPair = keyPairFromSeed("alice");

    const wrappedSdk = getWrappedSdkWithKeyPair(sdk, aliceKeyPair);

    const userLedger = sdk.userLedger!;

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
        instrumentId
    );

    if (!tokenFactoryContractId) {
        throw new Error("Error creating or getting token factory");
    }

    await wrappedSdk.tokenFactory.mintToken(tokenFactoryContractId, {
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

transferFactory()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in transferFactory: ", error);
        process.exit(1);
    });
