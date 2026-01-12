import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";

/**
 * ETF Setup Script
 *
 * Automates initial setup for ETF functionality:
 * 1. Allocates parties (custodian, alice)
 * 2. Creates infrastructure for 3 underlying tokens
 * 3. Mints underlying tokens to Alice (100 each)
 *
 * Note: Does NOT create portfolio composition or mint recipe (done in UI)
 */
export async function etfSetup() {
    console.info("=== ETF Setup Script ===\n");

    const custodianSdk = await getDefaultSdkAndConnect();
    const aliceSdk = await getDefaultSdkAndConnect();

    const custodianKeyPair = keyPairFromSeed("custodian");
    const aliceKeyPair = keyPairFromSeed("alice");

    const custodianLedger = custodianSdk.userLedger!;
    const aliceLedger = aliceSdk.userLedger!;

    const custodianWrappedSdk = getWrappedSdkWithKeyPair(
        custodianSdk,
        custodianKeyPair
    );
    const aliceWrappedSdk = getWrappedSdkWithKeyPair(aliceSdk, aliceKeyPair);

    // === PHASE 1: PARTY ALLOCATION ===
    console.info("1. Allocating parties...");

    // Allocate Custodian (issuer/admin)
    const custodianParty = await custodianLedger.generateExternalParty(
        custodianKeyPair.publicKey,
        "custodian"
    );
    if (!custodianParty) throw new Error("Error creating Custodian party");

    const custodianSignedHash = signTransactionHash(
        custodianParty.multiHash,
        custodianKeyPair.privateKey
    );
    const custodianAllocatedParty = await custodianLedger.allocateExternalParty(
        custodianSignedHash,
        custodianParty
    );

    const aliceParty = await aliceLedger.generateExternalParty(
        aliceKeyPair.publicKey,
        "alice"
    );
    if (!aliceParty) throw new Error("Error creating Alice party");

    const aliceSignedHash = signTransactionHash(
        aliceParty.multiHash,
        aliceKeyPair.privateKey
    );
    const aliceAllocatedParty = await aliceLedger.allocateExternalParty(
        aliceSignedHash,
        aliceParty
    );

    await custodianSdk.setPartyId(custodianAllocatedParty.partyId);
    await aliceSdk.setPartyId(aliceAllocatedParty.partyId);

    console.info("✓ Parties allocated:");
    console.info(`  Custodian (issuer): ${custodianAllocatedParty.partyId}`);
    console.info(`  Alice (minter):     ${aliceAllocatedParty.partyId}\n`);

    // === PHASE 2: INFRASTRUCTURE SETUP ===
    console.info("2. Setting up infrastructure (underlying tokens)...");

    // Instrument IDs for 3 underlying tokens
    const instrumentId1 = custodianAllocatedParty.partyId + "#Token1";
    const instrumentId2 = custodianAllocatedParty.partyId + "#Token2";
    const instrumentId3 = custodianAllocatedParty.partyId + "#Token3";
    const etfInstrumentId = custodianAllocatedParty.partyId + "#ThreeTokenETF";

    // Create token rules (shared for all transfers)
    const rulesCid = await custodianWrappedSdk.tokenRules.getOrCreate();
    console.info(`✓ MyTokenRules created: ${rulesCid}`);

    // Create token factories for underlying assets
    const tokenFactory1Cid = await custodianWrappedSdk.tokenFactory.getOrCreate(
        instrumentId1
    );
    console.info(`✓ Token1 factory created: ${tokenFactory1Cid}`);

    const tokenFactory2Cid = await custodianWrappedSdk.tokenFactory.getOrCreate(
        instrumentId2
    );
    console.info(`✓ Token2 factory created: ${tokenFactory2Cid}`);

    const tokenFactory3Cid = await custodianWrappedSdk.tokenFactory.getOrCreate(
        instrumentId3
    );
    console.info(`✓ Token3 factory created: ${tokenFactory3Cid}`);

    // Create transfer factories for underlying assets
    const transferFactory1Cid =
        await custodianWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 1 created: ${transferFactory1Cid}`);

    const transferFactory2Cid =
        await custodianWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 2 created: ${transferFactory2Cid}`);

    const transferFactory3Cid =
        await custodianWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 3 created: ${transferFactory3Cid}\n`);

    // Note: ETF tokens are created directly via MyMintRecipe (no factory needed)

    // === PHASE 3: MINT UNDERLYING TOKENS TO ALICE ===
    console.info("3. Minting underlying tokens to Alice (100 each)...");

    // Token 1
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory1Cid,
        issuer: custodianAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 100.0,
    });
    const mintRequest1Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        custodianAllocatedParty.partyId
    );
    if (!mintRequest1Cid) {
        throw new Error("Mint request 1 not found");
    }
    await custodianWrappedSdk.issuerMintRequest.accept(mintRequest1Cid);
    console.info("  ✓ Token1 minted to Alice (100.0)");

    // Token 2
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory2Cid,
        issuer: custodianAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 100.0,
    });
    const mintRequest2Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        custodianAllocatedParty.partyId
    );
    if (!mintRequest2Cid) {
        throw new Error("Mint request 2 not found");
    }
    await custodianWrappedSdk.issuerMintRequest.accept(mintRequest2Cid);
    console.info("  ✓ Token2 minted to Alice (100.0)");

    // Token 3
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory3Cid,
        issuer: custodianAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 100.0,
    });
    const mintRequest3Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        custodianAllocatedParty.partyId
    );
    if (!mintRequest3Cid) {
        throw new Error("Mint request 3 not found");
    }
    await custodianWrappedSdk.issuerMintRequest.accept(mintRequest3Cid);
    console.info("  ✓ Token3 minted to Alice (100.0)");

    console.info("✓ All 3 underlying tokens minted to Alice\n");

    // === RETURN SETUP RESULT ===
    const result = {
        parties: {
            custodian: custodianAllocatedParty.partyId,
            alice: aliceAllocatedParty.partyId,
        },
        tokens: {
            token1: {
                instrumentId: instrumentId1,
                tokenFactoryCid: tokenFactory1Cid,
                transferFactoryCid: transferFactory1Cid,
            },
            token2: {
                instrumentId: instrumentId2,
                tokenFactoryCid: tokenFactory2Cid,
                transferFactoryCid: transferFactory2Cid,
            },
            token3: {
                instrumentId: instrumentId3,
                tokenFactoryCid: tokenFactory3Cid,
                transferFactoryCid: transferFactory3Cid,
            },
        },
        etf: {
            instrumentId: etfInstrumentId,
        },
        rulesCid: rulesCid,
    };

    console.info("=== Setup Complete ===");
    console.info(JSON.stringify(result, null, 2));

    return result;
}
