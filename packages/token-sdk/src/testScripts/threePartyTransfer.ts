import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";
import {
    buildTransfer,
    emptyExtraArgs,
    getTransferInstructionDisclosure,
} from "../wrappedSdk/index.js";
import { tokenTransferInstructionTemplateId } from "../constants/templateIds.js";
import { ActiveContractResponse } from "../types/ActiveContractResponse.js";

/**
 * Three-party transfer test script demonstrating:
 * - Charlie (issuer) creates infrastructure (rules, factories)
 * - Charlie mints tokens to Alice
 * - Alice creates transfer request to send tokens to Bob
 * - Charlie accepts the request (locks tokens, creates transfer instruction)
 * - Bob accepts the transfer with disclosure
 *
 * NOTE: This script demonstrates the three-party transfer pattern,
 * but the final acceptance by Bob requires multi-party signing support
 * which is not fully implemented in the high-level Wallet SDK API.
 * See packages/token-sdk/CLAUDE.md for details on multi-party workarounds.
 */
async function threePartyTransfer() {
    console.info("=== Three-Party Transfer Test ===\n");

    // Initialize SDKs for three parties
    const charlieSdk = await getDefaultSdkAndConnect();
    const aliceSdk = await getDefaultSdkAndConnect();
    const bobSdk = await getDefaultSdkAndConnect();

    // NOTE: this is for testing only - use proper key management in production
    const charlieKeyPair = keyPairFromSeed("charlie");
    const aliceKeyPair = keyPairFromSeed("alice");
    const bobKeyPair = keyPairFromSeed("bob");

    const charlieLedger = charlieSdk.userLedger!;
    const aliceLedger = aliceSdk.userLedger!;
    const bobLedger = bobSdk.userLedger!;

    // TODO: refactor to use wrapped SDK throughout
    const charlieWrappedSdk = getWrappedSdkWithKeyPair(
        charlieSdk,
        charlieKeyPair
    );
    const aliceWrappedSdk = getWrappedSdkWithKeyPair(aliceSdk, aliceKeyPair);
    // const bobWrappedSdk = getWrappedSdkWithKeyPair(bobSdk, bobKeyPair);

    // === PARTY ALLOCATION ===
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

    // Allocate Alice (sender)
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

    // Allocate Bob (receiver)
    const bobParty = await bobLedger.generateExternalParty(
        bobKeyPair.publicKey
    );
    if (!bobParty) throw new Error("Error creating Bob party");

    const bobSignedHash = signTransactionHash(
        bobParty.multiHash,
        bobKeyPair.privateKey
    );
    const bobAllocatedParty = await bobLedger.allocateExternalParty(
        bobSignedHash,
        bobParty
    );

    // Set party IDs
    await charlieSdk.setPartyId(charlieAllocatedParty.partyId);
    await aliceSdk.setPartyId(aliceAllocatedParty.partyId);
    await bobSdk.setPartyId(bobAllocatedParty.partyId);

    console.info("✓ Parties allocated:");
    console.info(`  Charlie (issuer): ${charlieAllocatedParty.partyId}`);
    console.info(`  Alice (sender):   ${aliceAllocatedParty.partyId}`);
    console.info(`  Bob (receiver):   ${bobAllocatedParty.partyId}\n`);

    // === INFRASTRUCTURE SETUP ===
    console.info("2. Setting up infrastructure (Charlie as admin)...");

    const instrumentId = charlieAllocatedParty.partyId + "#MyToken";

    // Create MyTokenRules
    const rulesCid = await charlieWrappedSdk.tokenRules.getOrCreate();
    console.info(`✓ MyTokenRules created: ${rulesCid}`);

    // Create MyTransferFactory
    const transferFactoryCid =
        await charlieWrappedSdk.transferFactory.getOrCreate(rulesCid);
    console.info(`✓ MyTransferFactory created: ${transferFactoryCid}`);

    // Create MyTokenFactory
    const tokenFactoryCid = await charlieWrappedSdk.tokenFactory.getOrCreate(
        instrumentId
    );
    console.info(`✓ MyTokenFactory created: ${tokenFactoryCid}\n`);

    // === MINTING PHASE ===
    console.info("3. Minting tokens to Alice (two-step pattern)...");

    // Step 1: Alice creates mint request
    await aliceWrappedSdk.issuerMintRequest.create({
        tokenFactoryCid,
        issuer: charlieAllocatedParty.partyId,
        receiver: aliceAllocatedParty.partyId,
        amount: 100,
    });
    console.info("  ✓ Alice created mint request");

    // Step 2: Get the mint request contract ID
    const mintRequestCid = await aliceWrappedSdk.issuerMintRequest.getLatest(
        charlieAllocatedParty.partyId
    );

    if (!mintRequestCid) {
        throw new Error("Mint request not found after creation");
    }
    console.info(`  ✓ Mint request CID: ${mintRequestCid}`);

    // Step 3: Charlie accepts the request
    await charlieWrappedSdk.issuerMintRequest.accept(mintRequestCid);
    console.info("  ✓ Charlie accepted mint request");

    console.info("✓ Minted 100 tokens to Alice\n");

    // Check Alice's balance
    const aliceBalance = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: aliceAllocatedParty.partyId,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId,
        },
    });
    console.info(`Alice's balance: ${aliceBalance.total} tokens`);
    console.info(`Alice's UTXOs: ${aliceBalance.utxos.length}\n`);

    // Get the token contract ID (assume single UTXO for simplicity)
    const aliceTokenCid = aliceBalance.utxos[0].contractId;

    // === TRANSFER REQUEST PHASE ===
    console.info("4. Alice creates transfer request (50 tokens to Bob)...");

    const now = new Date();
    const transfer = buildTransfer({
        sender: aliceAllocatedParty.partyId,
        receiver: bobAllocatedParty.partyId,
        amount: 50,
        instrumentId: {
            admin: charlieAllocatedParty.partyId,
            id: instrumentId,
        },
        requestedAt: new Date(now.getTime() - 1000), // 1 second in the past
        executeBefore: new Date(now.getTime() + 3600000), // 1 hour in the future
        inputHoldingCids: [aliceTokenCid],
    });

    await aliceWrappedSdk.transferRequest.create({
        transferFactoryCid,
        expectedAdmin: charlieAllocatedParty.partyId,
        transfer,
        extraArgs: emptyExtraArgs(),
    });

    console.info("✓ Transfer request created\n");

    // === APPROVAL PHASE ===
    console.info("5. Charlie approves transfer request (locks tokens)...");

    const transferRequestCid = await aliceWrappedSdk.transferRequest.getLatest(
        charlieAllocatedParty.partyId
    );

    if (!transferRequestCid) {
        throw new Error("Transfer request not found");
    }

    await charlieWrappedSdk.transferRequest.accept(transferRequestCid);

    console.info("✓ Transfer request accepted by Charlie");
    console.info("✓ Tokens locked and MyTransferInstruction created\n");

    // === DISCLOSURE PHASE ===
    console.info("6. Getting disclosure for Bob...");

    // Note: We need to find the transfer instruction CID
    // In a real implementation, this would be returned from acceptTransferRequest
    // For now, we'll need to query for it
    console.info(
        "⚠ Finding transfer instruction (requires querying active contracts)..."
    );

    // Query for the transfer instruction
    const end = await charlieLedger.ledgerEnd();
    const transferInstructions = (await charlieLedger.activeContracts({
        offset: end.offset,
        templateIds: [tokenTransferInstructionTemplateId],
        filterByParty: true,
        parties: [charlieAllocatedParty.partyId],
    })) as ActiveContractResponse[]; // TODO: Use specific type once we define TransferInstructionParams

    if (transferInstructions.length === 0) {
        throw new Error("Transfer instruction not found");
    }

    const transferInstructionCid =
        transferInstructions[transferInstructions.length - 1].contractEntry
            .JsActiveContract?.createdEvent.contractId;

    if (!transferInstructionCid) {
        throw new Error("Transfer instruction CID not found");
    }

    console.info(`✓ Transfer instruction CID: ${transferInstructionCid}`);

    // Get disclosure
    const disclosure = await getTransferInstructionDisclosure(
        charlieLedger,
        transferInstructionCid
    );

    console.info("✓ Disclosure obtained for locked token\n");

    // === ACCEPTANCE PHASE ===
    console.info("7. Bob accepts transfer (requires multi-party signing)...");
    console.info(
        "⚠ NOTE: Full acceptance requires lower-level LedgerClient API"
    );
    console.info(
        "⚠ See packages/token-sdk/CLAUDE.md for multi-party workarounds\n"
    );

    console.info("Disclosure info:");
    console.info(
        `  Locked token CID: ${disclosure.lockedTokenDisclosure.contractId}`
    );
    console.info(
        `  Template ID: ${disclosure.lockedTokenDisclosure.templateId}`
    );
    console.info(
        `  Synchronizer ID: ${disclosure.lockedTokenDisclosure.synchronizerId}`
    );

    // TODO: Implement Bob's acceptance using lower-level API with disclosed contracts
    // This would require:
    // 1. Prepare submission with actAs: [bob, charlie, alice]
    // 2. Include disclosedContracts: [disclosure.lockedTokenDisclosure]
    // 3. Collect signatures from all required parties
    // 4. Execute submission with party signatures

    console.info(
        "\n✓ Three-party transfer flow demonstrated (up to disclosure)"
    );
    console.info(
        "  Final acceptance requires multi-party signing implementation"
    );
}

threePartyTransfer()
    .then(() => {
        console.info("\n=== Done ===");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error in threePartyTransfer:", error);
        throw error;
    });
