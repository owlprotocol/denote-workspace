/**
 * Setup script for Bond Demo
 *
 * This script automatically sets up:
 * 1. Custodian party (if it doesn't exist)
 * 2. Bond infrastructure (bond rules, lifecycle rule, currency)
 * 3. Default bond instrument
 */

import {
    keyPairFromSeed,
    getDefaultSdkAndConnect,
    getWrappedSdkWithKeyPairForParty,
} from "@denotecapital/token-sdk";
import { signTransactionHash } from "@canton-network/wallet-sdk";

const CUSTODIAN_SEED = "custodian";
const ALICE_SEED = "alice";
const BOB_SEED = "bob";
const DEFAULT_BOND_NAME = "TestBond";
const DEFAULT_NOTIONAL = 1000;
const DEFAULT_COUPON_RATE = 0.05;
const DEFAULT_COUPON_FREQUENCY = 2;
const DEFAULT_MATURITY_SECONDS = 120;

async function createParty(seed: string) {
    console.log(`Creating ${seed} party...`);

    const keyPair = keyPairFromSeed(seed);
    const sdk = await getDefaultSdkAndConnect();

    if (!sdk.userLedger) {
        throw new Error("SDK not connected");
    }

    const generatedParty = await sdk.userLedger.generateExternalParty(
        keyPair.publicKey,
        seed
    );

    if (!generatedParty) {
        throw new Error(`Error creating ${seed} party`);
    }

    const signedHash = signTransactionHash(
        generatedParty.multiHash,
        keyPair.privateKey
    );

    try {
        const allocatedParty = await sdk.userLedger.allocateExternalParty(
            signedHash,
            generatedParty
        );

        if (!allocatedParty) {
            throw new Error(`Error allocating ${seed} party`);
        }

        console.log(`${seed} party created: ${allocatedParty.partyId}`);
        return allocatedParty.partyId;
    } catch (error) {
        if (
            error instanceof Error &&
            (error.message.includes("already exists") ||
                error.message.includes("ALREADY_EXISTS"))
        ) {
            console.log(
                `${seed} party already exists: ${generatedParty.partyId}`
            );
            return generatedParty.partyId;
        }
        throw error;
    }
}

async function setupInfrastructure(custodianPartyId: string) {
    console.log("Setting up bond infrastructure...");

    const keyPair = keyPairFromSeed(CUSTODIAN_SEED);
    const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
        custodianPartyId,
        keyPair
    );

    const currencyInstrumentId = `${custodianPartyId}#Currency`;

    console.log("Creating bond rules...");
    const bondRulesCid = await wrappedSdk.bonds.bondRules.getOrCreate();
    console.log(`Bond rules: ${bondRulesCid.slice(0, 20)}...`);

    console.log("Creating lifecycle rule...");
    const lifecycleRuleCid = await wrappedSdk.bonds.lifecycleRule.getOrCreate({
        depository: custodianPartyId,
        currencyInstrumentId: {
            admin: custodianPartyId,
            id: currencyInstrumentId,
        },
    });
    console.log(`Lifecycle rule: ${lifecycleRuleCid.slice(0, 20)}...`);

    console.log("Setting up currency infrastructure...");
    const currencyRulesCid = await wrappedSdk.tokenRules.getOrCreate();
    const currencyTransferFactoryCid =
        await wrappedSdk.transferFactory.getOrCreate(currencyRulesCid);
    const currencyTokenFactoryCid = await wrappedSdk.tokenFactory.getOrCreate(
        currencyInstrumentId
    );
    console.log(`Currency infrastructure ready`);

    const existingCurrencyBalance = await wrappedSdk.balances.getByInstrumentId(
        {
            owner: custodianPartyId,
            instrumentId: {
                admin: custodianPartyId,
                id: currencyInstrumentId,
            },
        }
    );

    if (!existingCurrencyBalance || existingCurrencyBalance.total === 0) {
        console.log("Minting initial currency...");
        await wrappedSdk.tokenFactory.mintToken(currencyTokenFactoryCid, {
            amount: 10000.0,
            receiver: custodianPartyId,
        });
        console.log("Minted 10,000 currency units");
    } else {
        console.log(
            `Currency already exists (${existingCurrencyBalance.total} units)`
        );
    }

    console.log("Infrastructure setup complete");
}

async function createDefaultBondInstrument(custodianPartyId: string) {
    console.log("📝 Creating default bond instrument...");

    const keyPair = keyPairFromSeed(CUSTODIAN_SEED);
    const wrappedSdk = await getWrappedSdkWithKeyPairForParty(
        custodianPartyId,
        keyPair
    );

    const instrumentId = `${custodianPartyId}#${DEFAULT_BOND_NAME}`;

    const existingInstrumentCid =
        await wrappedSdk.bonds.factory.getLatestInstrument(instrumentId);

    if (existingInstrumentCid) {
        console.log(
            `Default bond instrument already exists: ${instrumentId} (${existingInstrumentCid.slice(
                0,
                20
            )}...)`
        );
        return;
    }

    const bondFactoryCid = await wrappedSdk.bonds.factory.getOrCreate(
        instrumentId
    );

    const maturityDate = new Date();
    maturityDate.setSeconds(
        maturityDate.getSeconds() + DEFAULT_MATURITY_SECONDS
    );

    await wrappedSdk.bonds.factory.createInstrument(
        bondFactoryCid,
        instrumentId,
        {
            depository: custodianPartyId,
            notional: DEFAULT_NOTIONAL,
            couponRate: DEFAULT_COUPON_RATE,
            couponFrequency: DEFAULT_COUPON_FREQUENCY,
            maturityDate: maturityDate.toISOString(),
        }
    );

    console.log(`Default bond instrument created: ${instrumentId}`);
    console.log(
        `  Parameters: Notional=${DEFAULT_NOTIONAL}, Rate=${
            DEFAULT_COUPON_RATE * 100
        }%, Frequency=${DEFAULT_COUPON_FREQUENCY}x, Maturity=${DEFAULT_MATURITY_SECONDS}s`
    );
}

async function main() {
    try {
        console.log("Starting bond demo setup...\n");

        const custodianPartyId = await createParty(CUSTODIAN_SEED);
        console.log("");
        const alicePartyId = await createParty(ALICE_SEED);
        console.log("");
        const bobPartyId = await createParty(BOB_SEED);
        console.log("");

        await setupInfrastructure(custodianPartyId);
        console.log("");

        await createDefaultBondInstrument(custodianPartyId);
        console.log("");

        console.log("Bond demo setup complete!");
        console.log(`Custodian Party: ${custodianPartyId}`);
        console.log(`Alice Party: ${alicePartyId}`);
        console.log(`Bob Party: ${bobPartyId}`);
        console.log(
            `Default Instrument: ${custodianPartyId}#${DEFAULT_BOND_NAME}`
        );

        process.exit(0);
    } catch (error) {
        console.error("Setup failed:", error);
        if (error instanceof Error) {
            console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
    }
}

main();
