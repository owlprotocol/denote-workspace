/**
 * Bond Lifecycle Test Script
 *
 * This script demonstrates the complete lifecycle of fungible bond instruments on Canton Network,
 * including minting, coupon payments, transfers, and redemption at maturity.
 *
 * ## Test Scenario:
 * - Charlie acts as both issuer and depository
 * - Alice receives 3 bond units (fungible bonds)
 * - Alice claims a coupon payment (receives currency)
 * - Alice transfers 1 bond unit to Bob (partial transfer, receives 2 bonds as change)
 * - Bob redeems his bond at maturity (receives principal + final coupon)
 * - Alice redeems her remaining 2 bonds
 *
 * ## Key Features Demonstrated:
 * 1. **Fungible Bond Architecture**: Mints 3 bond units in a single contract (notional × amount)
 * 2. **Per-Unit Payments**: Coupon payments calculated as (notional × rate / frequency) × amount
 * 3. **Partial Transfers**: BondRules automatically splits bonds (1 transferred, 2 returned as change)
 * 4. **Version Tracking**: Bond versions increment after each coupon event
 * 5. **Lifecycle Events**: Issuer creates effects that all holders can claim
 * 6. **Ledger Time Security**: Uses ledger time to prevent time manipulation
 * 7. **Term Inference**: Lifecycle rules infer bond terms from sample bond contracts
 * 8. **Disclosure Patterns**: Required for cross-party visibility (BondFactory, LockedBond)
 *
 * ## Bond Terms:
 * - Notional (face value per unit): $1000
 * - Coupon rate: 5% annual
 * - Coupon frequency: 2 (semi-annual)
 * - Maturity: 10 seconds after minting (for test speed)
 *
 * ## Expected Payments:
 * - Coupon payment: $1000 × 0.05 / 2 = $25 per bond
 *   - Alice (3 bonds): 3 × $25 = $75
 *   - Bob (1 bond after transfer): 1 × $25 = $25
 * - Redemption: Principal + final coupon
 *   - Bob: $1000 + $25 = $1025
 *   - Alice (2 bonds): 2 × $1025 = $2050
 *
 * Run with: `tsx src/testScripts/bondLifecycleTest.ts`
 */

import { signTransactionHash } from "@canton-network/wallet-sdk";
import { getDefaultSdkAndConnect } from "../sdkHelpers.js";
import { keyPairFromSeed } from "../helpers/keyPairFromSeed.js";
import { getWrappedSdkWithKeyPair } from "../wrappedSdk/wrappedSdk.js";
import { buildTransfer, emptyExtraArgs } from "../wrappedSdk/index.js";

async function printBalances(
    aliceWrappedSdk: ReturnType<typeof getWrappedSdkWithKeyPair>,
    bobWrappedSdk: ReturnType<typeof getWrappedSdkWithKeyPair>,
    alicePartyId: string,
    bobPartyId: string,
    bondInstrumentId: { admin: string; id: string },
    currencyInstrumentId: { admin: string; id: string },
    step: string
) {
    const aliceBondBalance = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: alicePartyId,
        instrumentId: bondInstrumentId,
    });
    const aliceCurrencyBalance =
        await aliceWrappedSdk.balances.getByInstrumentId({
            owner: alicePartyId,
            instrumentId: currencyInstrumentId,
        });
    const bobBondBalance = await bobWrappedSdk.balances.getByInstrumentId({
        owner: bobPartyId,
        instrumentId: bondInstrumentId,
    });
    const bobCurrencyBalance = await bobWrappedSdk.balances.getByInstrumentId({
        owner: bobPartyId,
        instrumentId: currencyInstrumentId,
    });

    console.info(`Balances (${step}):`);
    console.info(
        `Alice: Bond=${aliceBondBalance.total || 0}, Currency=${
            aliceCurrencyBalance.total || 0
        }`
    );
    console.info(
        `Bob: Bond=${bobBondBalance.total || 0}, Currency=${
            bobCurrencyBalance.total || 0
        }`
    );
}

async function bondLifecycleTest() {
    const charlieSdk = await getDefaultSdkAndConnect();
    const aliceSdk = await getDefaultSdkAndConnect();
    const bobSdk = await getDefaultSdkAndConnect();

    const charlieKeyPair = keyPairFromSeed("charlie");
    const aliceKeyPair = keyPairFromSeed("alice");
    const bobKeyPair = keyPairFromSeed("bob");

    const charlieLedger = charlieSdk.userLedger!;
    const charlieWrappedSdk = getWrappedSdkWithKeyPair(
        charlieSdk,
        charlieKeyPair
    );
    const aliceWrappedSdk = getWrappedSdkWithKeyPair(aliceSdk, aliceKeyPair);
    const bobWrappedSdk = getWrappedSdkWithKeyPair(bobSdk, bobKeyPair);

    // Allocate parties
    const charlieParty = await charlieLedger.generateExternalParty(
        charlieKeyPair.publicKey
    );
    if (!charlieParty) throw new Error("Error creating party");
    const charlieSignedHash = signTransactionHash(
        charlieParty.multiHash,
        charlieKeyPair.privateKey
    );
    const charlie = await charlieLedger.allocateExternalParty(
        charlieSignedHash,
        charlieParty
    );
    await charlieSdk.setPartyId(charlie.partyId);

    const aliceParty = await aliceSdk.userLedger!.generateExternalParty(
        aliceKeyPair.publicKey
    );
    if (!aliceParty) throw new Error("Error creating party");
    const aliceSignedHash = signTransactionHash(
        aliceParty.multiHash,
        aliceKeyPair.privateKey
    );
    const alice = await aliceSdk.userLedger!.allocateExternalParty(
        aliceSignedHash,
        aliceParty
    );
    await aliceSdk.setPartyId(alice.partyId);

    const bobParty = await bobSdk.userLedger!.generateExternalParty(
        bobKeyPair.publicKey
    );
    if (!bobParty) throw new Error("Error creating party");
    const bobSignedHash = signTransactionHash(
        bobParty.multiHash,
        bobKeyPair.privateKey
    );
    const bob = await bobSdk.userLedger!.allocateExternalParty(
        bobSignedHash,
        bobParty
    );
    await bobSdk.setPartyId(bob.partyId);

    console.info("Setting up infrastructure");
    const bondInstrumentId = charlie.partyId + "#Bond";
    const currencyInstrumentId = charlie.partyId + "#Currency";

    const bondRulesCid = await charlieWrappedSdk.bonds.bondRules.getOrCreate();
    const bondFactoryCid = await charlieWrappedSdk.bonds.factory.getOrCreate(
        bondInstrumentId,
        1000.0, // notional
        0.05, // couponRate (5% annual)
        2 // couponFrequency (semi-annual)
    );
    if (!bondFactoryCid) {
        throw new Error("Bond factory contract ID not found after getOrCreate");
    }
    console.info(`Bond factory CID: ${bondFactoryCid}`);
    const currencyRulesCid = await charlieWrappedSdk.tokenRules.getOrCreate();
    const currencyTransferFactoryCid =
        await charlieWrappedSdk.transferFactory.getOrCreate(currencyRulesCid);
    const currencyTokenFactoryCid =
        await charlieWrappedSdk.tokenFactory.getOrCreate(currencyInstrumentId);
    const lifecycleRuleCid =
        await charlieWrappedSdk.bonds.lifecycleRule.getOrCreate({
            depository: charlie.partyId,
            currencyInstrumentId: {
                admin: charlie.partyId,
                id: currencyInstrumentId,
            },
        });
    console.info("Infrastructure created\n");

    console.info("Minting currency tokens");
    await charlieWrappedSdk.tokenFactory.mintToken(currencyTokenFactoryCid, {
        amount: 75.0,
        receiver: charlie.partyId,
    });
    await charlieWrappedSdk.tokenFactory.mintToken(currencyTokenFactoryCid, {
        amount: 1025.0,
        receiver: charlie.partyId,
    });
    await charlieWrappedSdk.tokenFactory.mintToken(currencyTokenFactoryCid, {
        amount: 2050.0,
        receiver: charlie.partyId,
    });
    const currencyBalance = await charlieWrappedSdk.balances.getByInstrumentId({
        owner: charlie.partyId,
        instrumentId: { admin: charlie.partyId, id: currencyInstrumentId },
    });
    const [currencyHolding1, currencyHolding2, currencyHolding3] =
        currencyBalance.utxos.map((u) => u.contractId);
    if (!currencyHolding1 || !currencyHolding2 || !currencyHolding3) {
        throw new Error("Currency holdings not found");
    }
    console.info("Currency minted");

    // Phase 1: Create bond instrument, then mint 3 bonds to Alice
    console.info("Creating bond instrument");
    const now = new Date();
    const maturityDate = new Date(now.getTime() + 10 * 1000);
    const notional = 1000.0;
    const couponRate = 0.05; // 5% annual
    const couponFrequency = 2; // semi-annual

    const bondInstrumentCid =
        await charlieWrappedSdk.bonds.factory.createInstrument(
            bondFactoryCid,
            bondInstrumentId,
            {
                depository: charlie.partyId,
                notional,
                couponRate,
                couponFrequency,
                maturityDate: maturityDate.toISOString(),
            }
        );
    console.info(`Bond instrument created: ${bondInstrumentCid}`);

    console.info("Minting 3 bonds to Alice");
    await aliceWrappedSdk.bonds.issuerMintRequest.create({
        instrumentCid: bondInstrumentCid,
        issuer: charlie.partyId,
        receiver: alice.partyId,
        amount: 3.0, // Mint 3 bonds
    });
    const bondMintCid = await aliceWrappedSdk.bonds.issuerMintRequest.getLatest(
        charlie.partyId
    );
    if (!bondMintCid) throw new Error("Bond mint request not found");
    await charlieWrappedSdk.bonds.issuerMintRequest.accept(bondMintCid);

    const aliceBondBalance = await aliceWrappedSdk.balances.getByInstrumentId({
        owner: alice.partyId,
        instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
    });
    const aliceBondCid = aliceBondBalance.utxos[0]?.contractId;
    if (!aliceBondCid) throw new Error("Alice's bond not found");
    console.info("Bond minted");
    await printBalances(
        aliceWrappedSdk,
        bobWrappedSdk,
        alice.partyId,
        bob.partyId,
        { admin: charlie.partyId, id: bondInstrumentId },
        { admin: charlie.partyId, id: currencyInstrumentId },
        "after bond mint"
    );

    console.info("Processing coupon payment");
    console.info("  Waiting 3 seconds to ensure we're past issue date...");
    await new Promise((resolve) => {
        setTimeout(resolve, 3000);
    });

    await charlieWrappedSdk.bonds.lifecycleRule.processCouponPaymentEvent(
        lifecycleRuleCid,
        {
            targetInstrumentId: bondInstrumentId,
            targetVersion: "0",
            bondCid: aliceBondCid,
        }
    );

    const { contractId: effectCid1, producedVersion: bondVersionAfterCoupon } =
        await charlieWrappedSdk.bonds.lifecycleEffect.getLatest(
            charlie.partyId
        );
    if (!bondVersionAfterCoupon) {
        throw new Error("Produced version not found");
    }

    // Get bond instrument disclosure (Alice can't see it, but Charlie can)
    const bondInstrumentDisclosure =
        await charlieWrappedSdk.bonds.disclosure.getInstrumentDisclosure(
            bondInstrumentCid
        );

    // Holder creates claim request (with disclosure so Alice can reference the instrument)
    await aliceWrappedSdk.bonds.lifecycleClaimRequest.create(
        {
            effectCid: effectCid1,
            bondHoldingCid: aliceBondCid,
            bondRulesCid,
            bondInstrumentCid,
            currencyTransferFactoryCid,
            issuerCurrencyHoldingCid: currencyHolding1,
            holder: alice.partyId,
            issuer: charlie.partyId,
        },
        [bondInstrumentDisclosure]
    );

    // Issuer accepts claim request
    const claimCid1 =
        await aliceWrappedSdk.bonds.lifecycleClaimRequest.getLatest(
            charlie.partyId
        );
    if (!claimCid1) throw new Error("Lifecycle claim request not found");
    await charlieWrappedSdk.bonds.lifecycleClaimRequest.accept(claimCid1);

    // Holder processes instruction (with disclosure for coupon payment)
    const instructionCid1 =
        await charlieWrappedSdk.bonds.lifecycleInstruction.getLatest(
            charlie.partyId
        );
    await aliceWrappedSdk.bonds.lifecycleInstruction.process(instructionCid1, [
        bondInstrumentDisclosure,
    ]);

    // Holder accepts currency transfer if created
    const transferCid1 = await charlieWrappedSdk.transferInstruction.getLatest(
        charlie.partyId
    );
    if (transferCid1) {
        const transferDisclosure =
            await charlieWrappedSdk.transferInstruction.getDisclosure(
                transferCid1
            );
        await aliceWrappedSdk.transferInstruction.accept(transferCid1, [
            transferDisclosure.lockedTokenDisclosure,
        ]);
    }
    console.info("Coupon payment completed");
    await printBalances(
        aliceWrappedSdk,
        bobWrappedSdk,
        alice.partyId,
        bob.partyId,
        { admin: charlie.partyId, id: bondInstrumentId },
        { admin: charlie.partyId, id: currencyInstrumentId },
        "after coupon payment"
    );

    console.info("Transferring bond to Bob");
    const bondTransferFactoryCid =
        await charlieWrappedSdk.bonds.transferFactory.getOrCreate(bondRulesCid);

    const aliceBondAfterCoupon =
        await aliceWrappedSdk.balances.getByInstrumentId({
            owner: alice.partyId,
            instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
        });
    const aliceBondCidAfterCoupon = aliceBondAfterCoupon.utxos[0]?.contractId;
    if (!aliceBondCidAfterCoupon) throw new Error("Alice's bond not found");

    await aliceWrappedSdk.bonds.transferRequest.create({
        transferFactoryCid: bondTransferFactoryCid,
        expectedAdmin: charlie.partyId,
        transfer: buildTransfer({
            sender: alice.partyId,
            receiver: bob.partyId,
            amount: 1.0, // Transfer 1 bond (out of 3)
            instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
            requestedAt: new Date(now.getTime() - 1000),
            executeBefore: new Date(now.getTime() + 400 * 24 * 60 * 60 * 1000),
            inputHoldingCids: [aliceBondCidAfterCoupon],
        }),
        extraArgs: emptyExtraArgs(),
    });

    const transferRequestCid =
        await aliceWrappedSdk.bonds.transferRequest.getLatest(charlie.partyId);
    if (!transferRequestCid) throw new Error("Transfer request not found");
    await charlieWrappedSdk.bonds.transferRequest.accept(transferRequestCid);

    const transferInstrCid =
        await charlieWrappedSdk.bonds.transferInstruction.getLatest(
            charlie.partyId
        );
    if (!transferInstrCid) throw new Error("Transfer instruction not found");

    const disclosure =
        await charlieWrappedSdk.bonds.transferInstruction.getDisclosure(
            transferInstrCid
        );
    await bobWrappedSdk.bonds.transferInstruction.accept(transferInstrCid, [
        disclosure,
    ]);
    console.info("Bond transferred");

    // Get Alice's remaining bond after transfer (she should have 2 bonds remaining)
    const aliceBondAfterTransfer =
        await aliceWrappedSdk.balances.getByInstrumentId({
            owner: alice.partyId,
            instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
        });
    const aliceRemainingBondCid = aliceBondAfterTransfer.utxos[0]?.contractId;
    if (!aliceRemainingBondCid) {
        throw new Error("Alice's remaining bond not found");
    }

    await printBalances(
        aliceWrappedSdk,
        bobWrappedSdk,
        alice.partyId,
        bob.partyId,
        { admin: charlie.partyId, id: bondInstrumentId },
        { admin: charlie.partyId, id: currencyInstrumentId },
        "after transfer"
    );

    console.info("Processing redemption");
    console.info("  Waiting 3 seconds to ensure we're past maturity date...");
    await new Promise((resolve) => {
        setTimeout(resolve, 3000);
    });

    const bobBondBalance = await bobWrappedSdk.balances.getByInstrumentId({
        owner: bob.partyId,
        instrumentId: { admin: charlie.partyId, id: bondInstrumentId },
    });
    const bobBondCid = bobBondBalance.utxos[0]?.contractId;
    if (!bobBondCid) throw new Error("Bob's bond not found");

    await charlieWrappedSdk.bonds.lifecycleRule.processRedemptionEvent(
        lifecycleRuleCid,
        {
            targetInstrumentId: bondInstrumentId,
            targetVersion: bondVersionAfterCoupon,
            bondCid: bobBondCid,
        }
    );

    const { contractId: effectCid2 } =
        await charlieWrappedSdk.bonds.lifecycleEffect.getLatest(
            charlie.partyId
        );

    // Get bond instrument disclosure for Bob's claim request
    const bondInstrumentDisclosure2 =
        await charlieWrappedSdk.bonds.disclosure.getInstrumentDisclosure(
            bondInstrumentCid
        );

    // Holder creates claim request
    await bobWrappedSdk.bonds.lifecycleClaimRequest.create(
        {
            effectCid: effectCid2,
            bondHoldingCid: bobBondCid,
            bondRulesCid,
            bondInstrumentCid,
            currencyTransferFactoryCid,
            issuerCurrencyHoldingCid: currencyHolding2,
            holder: bob.partyId,
            issuer: charlie.partyId,
        },
        [bondInstrumentDisclosure2]
    );

    // Issuer accepts claim request
    const claimCid2 = await bobWrappedSdk.bonds.lifecycleClaimRequest.getLatest(
        charlie.partyId
    );
    if (!claimCid2) throw new Error("Lifecycle claim request not found");
    await charlieWrappedSdk.bonds.lifecycleClaimRequest.accept(claimCid2);

    // Holder processes instruction (no disclosure needed for redemption)
    const instructionCid2 =
        await charlieWrappedSdk.bonds.lifecycleInstruction.getLatest(
            charlie.partyId
        );
    await bobWrappedSdk.bonds.lifecycleInstruction.process(instructionCid2);

    // Holder accepts currency transfer if created
    const transferCid2 = await charlieWrappedSdk.transferInstruction.getLatest(
        charlie.partyId
    );
    if (transferCid2) {
        const transferDisclosure2 =
            await charlieWrappedSdk.transferInstruction.getDisclosure(
                transferCid2
            );
        await bobWrappedSdk.transferInstruction.accept(transferCid2, [
            transferDisclosure2.lockedTokenDisclosure,
        ]);
    }
    console.info("Bob's redemption completed");

    // Phase 5: Alice redeems her 2 remaining bonds
    console.info("Alice redeeming her 2 remaining bonds");
    // Get bond instrument disclosure for Alice's redemption claim request
    const bondInstrumentDisclosure3 =
        await charlieWrappedSdk.bonds.disclosure.getInstrumentDisclosure(
            bondInstrumentCid
        );

    await aliceWrappedSdk.bonds.lifecycleClaimRequest.create(
        {
            effectCid: effectCid2,
            bondHoldingCid: aliceRemainingBondCid,
            bondRulesCid,
            bondInstrumentCid,
            currencyTransferFactoryCid,
            issuerCurrencyHoldingCid: currencyHolding3,
            holder: alice.partyId,
            issuer: charlie.partyId,
        },
        [bondInstrumentDisclosure3]
    );

    const claimCid3 =
        await aliceWrappedSdk.bonds.lifecycleClaimRequest.getLatest(
            charlie.partyId
        );
    if (!claimCid3)
        throw new Error("Alice's lifecycle claim request not found");
    await charlieWrappedSdk.bonds.lifecycleClaimRequest.accept(claimCid3);

    const instructionCid3 =
        await charlieWrappedSdk.bonds.lifecycleInstruction.getLatest(
            charlie.partyId
        );
    await aliceWrappedSdk.bonds.lifecycleInstruction.process(instructionCid3);

    const transferCid3 = await charlieWrappedSdk.transferInstruction.getLatest(
        charlie.partyId
    );
    if (transferCid3) {
        const transferDisclosure3 =
            await charlieWrappedSdk.transferInstruction.getDisclosure(
                transferCid3
            );
        await aliceWrappedSdk.transferInstruction.accept(transferCid3, [
            transferDisclosure3.lockedTokenDisclosure,
        ]);
    }
    console.info("Alice's redemption completed");
    await printBalances(
        aliceWrappedSdk,
        bobWrappedSdk,
        alice.partyId,
        bob.partyId,
        { admin: charlie.partyId, id: bondInstrumentId },
        { admin: charlie.partyId, id: currencyInstrumentId },
        "final"
    );
}

bondLifecycleTest()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Error in bondLifecycleTest:", error);
        throw error;
    });
