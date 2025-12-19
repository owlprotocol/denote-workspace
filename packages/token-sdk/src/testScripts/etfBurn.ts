import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";
import { buildTransfer, emptyExtraArgs } from "../wrappedSdk/index.js";

/**
 * ETF Burn Test Script (following burnTokenETF Daml test pattern)
 *
 * Demonstrates:
 * 1. Charlie (issuer) creates infrastructure for 3 underlying tokens and 1 ETF token
 * 2. Charlie creates portfolio composition (3 items with 1.0 weight each)
 * 3. Charlie creates mint recipe (authorizes Alice as minter)
 * 4. Alice mints 3 underlying tokens via IssuerMintRequest
 * 5. Alice transfers 3 underlying tokens to Charlie (issuer custody)
 * 6. Alice creates ETF mint request with transfer instructions
 * 7. Charlie accepts ETF mint request (validates, executes transfers, mints ETF)
 * 8. Alice now owns 1.0 ETF token backed by underlying assets in Charlie's custody
 * 9. Charlie creates transfer requests for 3 underlying tokens back to Alice
 * 10. Charlie accepts transfer requests (creates 3 transfer instructions)
 * 11. Alice creates ETF burn request with transfer instructions
 * 12. Charlie accepts ETF burn request (validates, executes transfers, burns ETF)
 * 13. Alice now owns 3 underlying tokens again, ETF token is burned
 */
async function etfBurn() {
    console.info("=== ETF Burn Test (burnTokenETF pattern) ===\n");

    // Initialize SDKs for two parties
    const charlieSdk = await getDefaultSdkAndConnect();
    const aliceSdk = await getDefaultSdkAndConnect();

    // NOTE: this is for testing only - use proper key management in production
    const charlieKeyPair = keyPairFromSeed("charlie-etf-burn");
    const aliceKeyPair = keyPairFromSeed("alice-etf-burn");

    const charlieLedger = charlieSdk.userLedger!;
    const aliceLedger = aliceSdk.userLedger!;

    const charlieWrappedSdk = getWrappedSdkWithKeyPair(
        charlieSdk,
        charlieKeyPair
    );
    const aliceWrappedSdk = getWrappedSdkWithKeyPair(aliceSdk, aliceKeyPair);

    // === PHASE 1: PARTY ALLOCATION ===
    console.info("1. Allocating parties...");

    // Allocate Charlie (issuer/admin)
    const charlieParty = await charlieLedger.generateExternalParty(
        charlieKeyPair.publicKey
    );
    if (!charlieParty) throw new Error("Error creating Charlie party");

    const charlieSignedHash = signTransactionHash(
        charlieParty.multiHash,
        charlieKeyPair.privateKey
    );
    const charlieAllocatedParty = await charlieLedger.allocateExternalParty(
        charlieSignedHash,
        charlieParty
    );

    // Allocate Alice (authorized minter)
    const aliceParty = await aliceLedger.generateExternalParty(
        aliceKeyPair.publicKey
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

    // Set party IDs
    await charlieSdk.setPartyId(charlieAllocatedParty.partyId);
    await aliceSdk.setPartyId(aliceAllocatedParty.partyId);

    console.info("✓ Parties allocated:");
    console.info(`  Charlie (issuer):       ${charlieAllocatedParty.partyId}`);
    console.info(`  Alice (auth minter):    ${aliceAllocatedParty.partyId}\n`);

    // === PHASE 2: INFRASTRUCTURE SETUP ===
    console.info("2. Setting up infrastructure (underlying tokens + ETF)...");

    // Instrument IDs for 3 underlying tokens
    const instrumentId1 = charlieAllocatedParty.partyId + "#MyToken1";
    const instrumentId2 = charlieAllocatedParty.partyId + "#MyToken2";
    const instrumentId3 = charlieAllocatedParty.partyId + "#MyToken3";
    const etfInstrumentId = charlieAllocatedParty.partyId + "#ThreeTokenETF";

    // Create token rules (shared for all transfers)
    const rulesCid = await charlieWrappedSdk.tokenRules.getOrCreate();
    console.info(`✓ MyTokenRules created: ${rulesCid}`);

    // Create token factories for underlying assets
    const tokenFactory1Cid = await charlieWrappedSdk.tokenFactory.getOrCreate(
        instrumentId1
    );
    console.info(`✓ Token1 factory created: ${tokenFactory1Cid}`);

    const tokenFactory2Cid = await charlieWrappedSdk.tokenFactory.getOrCreate(
        instrumentId2
    );
    console.info(`✓ Token2 factory created: ${tokenFactory2Cid}`);

    const tokenFactory3Cid = await charlieWrappedSdk.tokenFactory.getOrCreate(
        instrumentId3
    );
    console.info(`✓ Token3 factory created: ${tokenFactory3Cid}`);

    // Create transfer factories for underlying assets
    const transferFactory1Cid =
        await charlieWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 1 created: ${transferFactory1Cid}`);

    const transferFactory2Cid =
        await charlieWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 2 created: ${transferFactory2Cid}`);

    const transferFactory3Cid =
        await charlieWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ Transfer factory 3 created: ${transferFactory3Cid}`);

    // === PHASE 3: PORTFOLIO COMPOSITION CREATION ===
    console.info("3. Creating portfolio composition...");

    const portfolioItems = [
        {
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId1,
            },
            weight: 1.0,
        },
        {
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId2,
            },
            weight: 1.0,
        },
        {
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId3,
            },
            weight: 1.0,
        },
    ];

    await charlieWrappedSdk.etf.portfolioComposition.create({
        owner: charlieAllocatedParty.partyId,
        name: "Three Token ETF",
        items: portfolioItems,
    });

    const portfolioCid =
        await charlieWrappedSdk.etf.portfolioComposition.getLatest(
            "Three Token ETF"
        );
    if (!portfolioCid) {
        throw new Error("Portfolio composition not found after creation");
    }
    console.info(`✓ Portfolio composition created: ${portfolioCid}\n`);

    // === PHASE 4: MINT RECIPE CREATION ===
    console.info("4. Creating mint recipe...");

    await charlieWrappedSdk.etf.mintRecipe.create({
        issuer: charlieAllocatedParty.partyId,
        instrumentId: etfInstrumentId,
        authorizedMinters: [
            charlieAllocatedParty.partyId,
            aliceAllocatedParty.partyId,
        ],
        composition: portfolioCid,
    });

    const mintRecipeCid = await charlieWrappedSdk.etf.mintRecipe.getLatest(
        etfInstrumentId
    );
    if (!mintRecipeCid) {
        throw new Error("Mint recipe not found after creation");
    }
    console.info(`✓ Mint recipe created: ${mintRecipeCid}`);
    console.info(`  Authorized minters: [Charlie, Alice]\n`);

    // === PHASE 5: MINT UNDERLYING TOKENS TO ALICE ===
    console.info(
        "5. Minting underlying tokens to Alice (3 IssuerMintRequests)..."
    );

    // Token 1
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory1Cid,
        issuer: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
    });
    const mintRequest1Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!mintRequest1Cid) {
        throw new Error("Mint request 1 not found");
    }
    await charlieWrappedSdk.issuerMintRequest.accept(mintRequest1Cid);
    console.info("  ✓ Token1 minted to Alice (1.0)");

    // Token 2
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory2Cid,
        issuer: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
    });
    const mintRequest2Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!mintRequest2Cid) {
        throw new Error("Mint request 2 not found");
    }
    await charlieWrappedSdk.issuerMintRequest.accept(mintRequest2Cid);
    console.info("  ✓ Token2 minted to Alice (1.0)");

    // Token 3
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid: tokenFactory3Cid,
        issuer: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
    });
    const mintRequest3Cid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!mintRequest3Cid) {
        throw new Error("Mint request 3 not found");
    }
    await charlieWrappedSdk.issuerMintRequest.accept(mintRequest3Cid);
    console.info("  ✓ Token3 minted to Alice (1.0)");

    console.info("✓ All 3 underlying tokens minted to Alice\n");

    // Get Alice's token balances
    const aliceBalance1 = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId1,
        },
    });
    const token1Cid = aliceBalance1.utxos[0].contractId;

    const aliceBalance2 = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId2,
        },
    });
    const token2Cid = aliceBalance2.utxos[0].contractId;

    const aliceBalance3 = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId3,
        },
    });
    const token3Cid = aliceBalance3.utxos[0].contractId;

    console.info(`  Token1 CID: ${token1Cid}`);
    console.info(`  Token2 CID: ${token2Cid}`);
    console.info(`  Token3 CID: ${token3Cid}\n`);

    // === PHASE 6: TRANSFER UNDERLYING TOKENS TO ISSUER ===
    console.info(
        "6. Transferring underlying tokens to issuer (Alice → Charlie)..."
    );

    const now = new Date();
    const requestedAtPast = new Date(now.getTime() - 1000); // 1 second in the past
    const future = new Date(now.getTime() + 3600000); // 1 hour in the future

    // Transfer Token 1
    const transfer1 = buildTransfer({
        sender: aliceAllocatedParty.partyId,
        receiver: charlieAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId1,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [token1Cid],
    });

    await aliceWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory1Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: transfer1,
        extraArgs: emptyExtraArgs(),
    });

    const transferRequest1Cid = await aliceWrappedSdk.transferRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!transferRequest1Cid) {
        throw new Error("Transfer request 1 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(transferRequest1Cid);
    console.info("  ✓ Transfer request 1 accepted (Token1)");

    // Get transfer instruction CID 1 immediately
    const transferInstruction1Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!transferInstruction1Cid) {
        throw new Error("Transfer instruction 1 not found");
    }

    // Transfer Token 2
    const transfer2 = buildTransfer({
        sender: aliceAllocatedParty.partyId,
        receiver: charlieAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId2,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [token2Cid],
    });

    await aliceWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory2Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: transfer2,
        extraArgs: emptyExtraArgs(),
    });

    const transferRequest2Cid = await aliceWrappedSdk.transferRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!transferRequest2Cid) {
        throw new Error("Transfer request 2 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(transferRequest2Cid);
    console.info("  ✓ Transfer request 2 accepted (Token2)");

    // Get transfer instruction CID 2 immediately
    const transferInstruction2Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!transferInstruction2Cid) {
        throw new Error("Transfer instruction 2 not found");
    }

    // Transfer Token 3
    const transfer3 = buildTransfer({
        sender: aliceAllocatedParty.partyId,
        receiver: charlieAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId3,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [token3Cid],
    });

    await aliceWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory3Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: transfer3,
        extraArgs: emptyExtraArgs(),
    });

    const transferRequest3Cid = await aliceWrappedSdk.transferRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!transferRequest3Cid) {
        throw new Error("Transfer request 3 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(transferRequest3Cid);
    console.info("  ✓ Transfer request 3 accepted (Token3)");

    // Get transfer instruction CID 3 immediately
    const transferInstruction3Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!transferInstruction3Cid) {
        throw new Error("Transfer instruction 3 not found");
    }

    console.info(
        "✓ All 3 transfer requests accepted (tokens locked, instructions created)\n"
    );
    console.info(`  Transfer instruction 1: ${transferInstruction1Cid}`);
    console.info(`  Transfer instruction 2: ${transferInstruction2Cid}`);
    console.info(`  Transfer instruction 3: ${transferInstruction3Cid}\n`);

    // === PHASE 7: CREATE ETF MINT REQUEST ===
    console.info(
        "7. Creating ETF mint request (with 3 transfer instructions)..."
    );

    await aliceWrappedSdk.etf.mintRequest.create({
        mintRecipeCid,
        requester: aliceAllocatedParty.partyId,
        amount: 1.0,
        transferInstructionCids: [
            transferInstruction1Cid,
            transferInstruction2Cid,
            transferInstruction3Cid,
        ],
        issuer: charlieAllocatedParty.partyId,
    });

    const etfMintRequestCid = await aliceWrappedSdk.etf.mintRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!etfMintRequestCid) {
        throw new Error("ETF mint request not found after creation");
    }

    console.info(`✓ ETF mint request created: ${etfMintRequestCid}`);
    console.info(`  Amount: 1.0 ETF tokens`);
    console.info(`  Transfer instructions: [3 underlying tokens]\n`);

    // === PHASE 8: ACCEPT ETF MINT REQUEST ===
    console.info(
        "8. Accepting ETF mint request (Charlie validates and mints)..."
    );

    await charlieWrappedSdk.etf.mintRequest.accept(etfMintRequestCid);

    console.info("✓ ETF mint request accepted!");
    console.info("  - Validated all 3 transfer instructions");
    console.info(
        "  - Executed all 3 transfers (underlying assets → issuer custody)"
    );
    console.info("  - Minted 1.0 ETF tokens to Alice\n");

    // Verify Alice's ETF balance
    const aliceEtfBalance = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: etfInstrumentId,
        },
    });

    const etfTokenCid = aliceEtfBalance.utxos[0].contractId;

    console.info("=== State After ETF Mint ==");
    console.info(`✓ Alice owns ${aliceEtfBalance.total} ETF tokens`);
    console.info(`  ETF Token CID: ${etfTokenCid}`);
    console.info(`✓ Charlie (issuer) holds 3 underlying tokens in custody\n`);

    // === PHASE 9: CHARLIE TRANSFERS UNDERLYING BACK TO ALICE ===
    console.info(
        "9. Charlie transferring underlying tokens back to Alice (Charlie → Alice)..."
    );

    // Get Charlie's token balances (the 3 underlying tokens in custody)
    const charlieBalance1 = await charlieWrappedSdk.balances.getByInstrumentId({
        owner: charlieAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId1,
        },
    });
    const charlieToken1Cid = charlieBalance1.utxos[0].contractId;

    const charlieBalance2 = await charlieWrappedSdk.balances.getByInstrumentId({
        owner: charlieAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId2,
        },
    });
    const charlieToken2Cid = charlieBalance2.utxos[0].contractId;

    const charlieBalance3 = await charlieWrappedSdk.balances.getByInstrumentId({
        owner: charlieAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId3,
        },
    });
    const charlieToken3Cid = charlieBalance3.utxos[0].contractId;

    console.info(`  Charlie's Token1 CID: ${charlieToken1Cid}`);
    console.info(`  Charlie's Token2 CID: ${charlieToken2Cid}`);
    console.info(`  Charlie's Token3 CID: ${charlieToken3Cid}\n`);

    // Transfer Token 1 back to Alice
    const returnTransfer1 = buildTransfer({
        sender: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId1,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [charlieToken1Cid],
    });

    await charlieWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory1Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: returnTransfer1,
        extraArgs: emptyExtraArgs(),
    });

    const returnTransferRequest1Cid =
        await charlieWrappedSdk.transferRequest.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferRequest1Cid) {
        throw new Error("Return transfer request 1 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(returnTransferRequest1Cid);
    console.info("  ✓ Return transfer request 1 accepted (Token1)");

    // Get return transfer instruction CID 1 immediately
    const returnTransferInstruction1Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferInstruction1Cid) {
        throw new Error("Return transfer instruction 1 not found");
    }

    // Transfer Token 2 back to Alice
    const returnTransfer2 = buildTransfer({
        sender: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId2,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [charlieToken2Cid],
    });

    await charlieWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory2Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: returnTransfer2,
        extraArgs: emptyExtraArgs(),
    });

    const returnTransferRequest2Cid =
        await charlieWrappedSdk.transferRequest.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferRequest2Cid) {
        throw new Error("Return transfer request 2 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(returnTransferRequest2Cid);
    console.info("  ✓ Return transfer request 2 accepted (Token2)");

    // Get return transfer instruction CID 2 immediately
    const returnTransferInstruction2Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferInstruction2Cid) {
        throw new Error("Return transfer instruction 2 not found");
    }

    // Transfer Token 3 back to Alice
    const returnTransfer3 = buildTransfer({
        sender: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 1.0,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId3,
        },
        requestedAt: requestedAtPast,
        executeBefore: future,
        inputHoldingCids: [charlieToken3Cid],
    });

    await charlieWrappedSdk.transferRequest.create({
        transferFactoryCid: transferFactory3Cid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer: returnTransfer3,
        extraArgs: emptyExtraArgs(),
    });

    const returnTransferRequest3Cid =
        await charlieWrappedSdk.transferRequest.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferRequest3Cid) {
        throw new Error("Return transfer request 3 not found");
    }

    await charlieWrappedSdk.transferRequest.accept(returnTransferRequest3Cid);
    console.info("  ✓ Return transfer request 3 accepted (Token3)");

    // Get return transfer instruction CID 3 immediately
    const returnTransferInstruction3Cid =
        await charlieWrappedSdk.transferInstruction.getLatest(
            charlieAllocatedParty.partyId
        );
    if (!returnTransferInstruction3Cid) {
        throw new Error("Return transfer instruction 3 not found");
    }

    console.info(
        "✓ All 3 return transfer requests accepted (tokens locked, instructions created)\n"
    );
    console.info(
        `  Return transfer instruction 1: ${returnTransferInstruction1Cid}`
    );
    console.info(
        `  Return transfer instruction 2: ${returnTransferInstruction2Cid}`
    );
    console.info(
        `  Return transfer instruction 3: ${returnTransferInstruction3Cid}\n`
    );

    // === PHASE 10: CREATE ETF BURN REQUEST ===
    console.info(
        "10. Alice creating ETF burn request (with 3 return transfer instructions)..."
    );

    await aliceWrappedSdk.etf.burnRequest.create({
        mintRecipeCid,
        requester: aliceAllocatedParty.partyId,
        amount: 1.0,
        inputHoldingCid: etfTokenCid,
        issuer: charlieAllocatedParty.partyId,
    });

    const etfBurnRequestCid = await aliceWrappedSdk.etf.burnRequest.getLatest(
        charlieAllocatedParty.partyId
    );
    if (!etfBurnRequestCid) {
        throw new Error("ETF burn request not found after creation");
    }

    console.info(`✓ ETF burn request created: ${etfBurnRequestCid}`);
    console.info(`  Amount: 1.0 ETF tokens to burn`);
    console.info(`  Return transfer instructions: [3 underlying tokens]\n`);

    // === PHASE 11: ACCEPT ETF BURN REQUEST ===
    console.info(
        "11. Accepting ETF burn request (Charlie validates and burns)..."
    );

    await charlieWrappedSdk.etf.burnRequest.accept(etfBurnRequestCid, [
        returnTransferInstruction1Cid,
        returnTransferInstruction2Cid,
        returnTransferInstruction3Cid,
    ]);

    console.info("✓ ETF burn request accepted!");
    console.info("  - Validated all 3 return transfer instructions");
    console.info(
        "  - Executed all 3 transfers (underlying assets → Alice custody)"
    );
    console.info("  - Burned 1.0 ETF tokens from Alice\n");

    // === FINAL VERIFICATION ===
    console.info("=== Final State ==");

    // Verify Alice's ETF balance (should be 0)
    const finalAliceEtfBalance =
        await aliceWrappedSdk.balances.getByInstrumentId({
            owner: aliceAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: etfInstrumentId,
            },
        });
    console.info(`✓ Alice owns ${finalAliceEtfBalance.total} ETF tokens`);

    // Verify Alice's underlying balances (should be 1.0 each)
    const finalAliceBalance1 = await aliceWrappedSdk.balances.getByInstrumentId(
        {
            owner: aliceAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId1,
            },
        }
    );
    const finalAliceBalance2 = await aliceWrappedSdk.balances.getByInstrumentId(
        {
            owner: aliceAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId2,
            },
        }
    );
    const finalAliceBalance3 = await aliceWrappedSdk.balances.getByInstrumentId(
        {
            owner: aliceAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId3,
            },
        }
    );

    console.info(
        `✓ Alice owns ${finalAliceBalance1.total} Token1, ${finalAliceBalance2.total} Token2, ${finalAliceBalance3.total} Token3`
    );

    // Verify Charlie's balances (should be 0 for all)
    const finalCharlieBalance1 =
        await charlieWrappedSdk.balances.getByInstrumentId({
            owner: charlieAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId1,
            },
        });
    const finalCharlieBalance2 =
        await charlieWrappedSdk.balances.getByInstrumentId({
            owner: charlieAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId2,
            },
        });
    const finalCharlieBalance3 =
        await charlieWrappedSdk.balances.getByInstrumentId({
            owner: charlieAllocatedParty.partyId,
            instrumentId: {
                admin: charlieAllocatedParty.partyId,
                id: instrumentId3,
            },
        });

    console.info(
        `✓ Charlie (issuer) holds ${finalCharlieBalance1.total} Token1, ${finalCharlieBalance2.total} Token2, ${finalCharlieBalance3.total} Token3 in custody`
    );
    console.info(`✓ ETF burn complete - underlying assets returned to Alice\n`);
}

etfBurn()
    .then(() => {
        console.info("=== ETF Burn Test Completed Successfully ===");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error in ETF Burn Test:", error);
        throw error;
    });
