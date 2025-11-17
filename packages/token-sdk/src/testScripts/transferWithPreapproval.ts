import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";

async function transferPreapproval() {
    const aliceSdk = await getDefaultSdkAndConnect();
    const bobSdk = await getDefaultSdkAndConnect();

    // NOTE: this is of course for testing
    const aliceKeyPair = keyPairFromSeed("alice");
    const bobKeyPair = keyPairFromSeed("bob");

    const aliceUserLedger = aliceSdk.userLedger!;
    const bobUserLedger = bobSdk.userLedger!;

    const aliceWrappedSdk = getWrappedSdkWithKeyPair(aliceSdk, aliceKeyPair);
    const bobWrappedSdk = getWrappedSdkWithKeyPair(bobSdk, bobKeyPair);

    const aliceParty = await aliceUserLedger.generateExternalParty(
        aliceKeyPair.publicKey
    );

    if (!aliceParty) {
        throw new Error("Error creating Alice party");
    }

    const aliceSignedHash = signTransactionHash(
        aliceParty.multiHash,
        aliceKeyPair.privateKey
    );

    const aliceAllocatedParty = await aliceUserLedger.allocateExternalParty(
        aliceSignedHash,
        aliceParty
    );

    const bobParty = await bobUserLedger.generateExternalParty(
        bobKeyPair.publicKey
    );

    if (!bobParty) {
        throw new Error("Error creating Bob party");
    }

    const bobSignedHash = signTransactionHash(
        bobParty.multiHash,
        bobKeyPair.privateKey
    );

    const bobAllocatedParty = await bobUserLedger.allocateExternalParty(
        bobSignedHash,
        bobParty
    );

    await aliceSdk.setPartyId(aliceAllocatedParty.partyId);
    await bobSdk.setPartyId(bobAllocatedParty.partyId);

    const instrumentId = aliceAllocatedParty.partyId + "#MyToken";
    const tokenFactoryContractId =
        await aliceWrappedSdk.tokenFactory.getOrCreate(instrumentId);

    if (!tokenFactoryContractId) {
        throw new Error("Error creating or getting token factory");
    }

    await aliceWrappedSdk.tokenFactory.mintToken({
        tokenFactoryContractId,
        amount: 1000,
        receiver: aliceAllocatedParty.partyId,
    });
    console.info("Minted 1000 tokens to Alice");

    const tokenBalance = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: aliceAllocatedParty.partyId,
            id: instrumentId,
        },
    });

    // Assume there is only one UTXO for simplicity
    const tokenContractId = tokenBalance.utxos[0].contractId;

    console.log({ tokenBalance, tokenContractId });

    console.info("Preparing to transfer 500 tokens from Alice to Bob");

    console.info("Checking for existing transfer preapproval");
    let transferPreapprovalCid =
        await aliceWrappedSdk.transferPreapproval.getLatest({
            issuer: aliceAllocatedParty.partyId,
            instrumentId,
            receiver: bobAllocatedParty.partyId,
        });

    if (!transferPreapprovalCid) {
        console.info(
            "Creating transfer preapproval proposal if it does not already exist"
        );
        const transferPreapprovalProposalContractId =
            await aliceWrappedSdk.transferPreapprovalProposal.getOrCreate({
                instrumentId,
                receiver: bobAllocatedParty.partyId,
            });

        console.info(
            "Transfer preapproval proposal contract ID: ",
            transferPreapprovalProposalContractId
        );

        console.info("Having Bob accept the transfer preapproval");
        await bobWrappedSdk.transferPreapprovalProposal.accept({
            transferPreapprovalProposalContractId,
        });

        console.info("Retrieving the latest transfer preapproval");
        transferPreapprovalCid =
            await aliceWrappedSdk.transferPreapproval.getLatest({
                issuer: aliceAllocatedParty.partyId,
                receiver: bobAllocatedParty.partyId,
                instrumentId,
            });
    }

    if (!transferPreapprovalCid) {
        throw new Error("Error creating or getting transfer preapproval");
    }

    console.info("Transferring 500 tokens from Alice to Bob with preapproval");

    await aliceWrappedSdk.transferPreapproval.send({
        tokenCid: tokenContractId,
        transferPreapprovalContractId: transferPreapprovalCid,
        sender: aliceAllocatedParty.partyId,
        amount: 500,
    });

    console.info("Transferred 500 tokens from Alice to Bob");

    const tokenBalanceAfter = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: { admin: aliceAllocatedParty.partyId, id: instrumentId },
    });
    console.log({ tokenBalanceAfter });

    const bobTokenBalance = await bobWrappedSdk.balances.getByInstrumentId({
        owner: bobAllocatedParty.partyId,
        instrumentId: { admin: aliceAllocatedParty.partyId, id: instrumentId },
    });
    console.log({
        bobTokenBalanceTotal: bobTokenBalance.total,
        bobUtxoCids: bobTokenBalance.utxos.map((u) => u.contractId),
    });
}

transferPreapproval()
    .then(() => {
        console.info("Done");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in transferPreapproval: ", error);
        throw error;
    });
