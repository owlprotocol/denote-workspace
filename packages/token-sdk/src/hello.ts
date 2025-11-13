import { PrettyContract, Holding } from "@canton-network/core-ledger-client";
import {
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    signTransactionHash,
    WalletSDKImpl,
} from "@canton-network/wallet-sdk";
import { pino } from "pino";
import {
    formatHoldingUtxo,
    getBalanceByInstrumentId,
    getBalances,
    getOrCreateTokenFactory,
    mintToken,
    transferToken,
} from "./helpers.js";
import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

const logger = pino({ name: "token-frontend", level: "info" });

const sdk = new WalletSDKImpl().configure({
    logger,
    authFactory: localNetAuthDefault,
    ledgerFactory: localNetLedgerDefault,
    tokenStandardFactory: localNetTokenStandardDefault,
});

const tokenFactoryTemplateId = "#minimal-token:MyTokenFactory:MyTokenFactory";
const tokenTemplateId = "#minimal-token:MyToken:MyToken";

// const client = createClient<paths>({
//     baseUrl: "http://localhost:7575/",
// });
//
// const parties = (await client.GET("/v2/parties")).data;
// console.log({ parties });

await sdk.connect();
await sdk.connectAdmin();

logger.info("Connecting to topology");
// await sdk.connectTopology(localNetStaticConfig.LOCALNET_SCAN_PROXY_API_URL);
const LOCALNET_SCAN_PROXY_API_URL = new URL(
    "http://localhost:2000/api/validator"
);
await sdk.connectTopology(LOCALNET_SCAN_PROXY_API_URL);

const keyPairFromSeed = (seed: string) => {
    const pair = nacl.sign.keyPair.fromSeed(Buffer.from(seed.padEnd(32, "0")));
    return {
        publicKey: naclUtil.encodeBase64(pair.publicKey),
        privateKey: naclUtil.encodeBase64(pair.secretKey),
    };
};

// NOTE: this is of course for testing
const aliceKeyPair = keyPairFromSeed("alice");
const bobKeyPair = keyPairFromSeed("bob");

const aliceParty = await sdk.userLedger?.generateExternalParty(
    aliceKeyPair.publicKey
);

if (!aliceParty) {
    throw new Error("Error creating Alice party");
}

const aliceSignedHash = signTransactionHash(
    aliceParty.multiHash,
    aliceKeyPair.privateKey
);

const aliceAllocatedParty = await sdk.userLedger?.allocateExternalParty(
    aliceSignedHash,
    aliceParty
);

const bobParty = await sdk.userLedger?.generateExternalParty(
    bobKeyPair.publicKey
);

if (!bobParty) {
    throw new Error("Error creating Bob party");
}

const bobSignedHash = signTransactionHash(
    bobParty.multiHash,
    bobKeyPair.privateKey
);

const bobAllocatedParty = await sdk.userLedger?.allocateExternalParty(
    bobSignedHash,
    bobParty
);

await sdk.setPartyId(aliceAllocatedParty!.partyId);

// TODO: only create the token factory if it doesn't already exist

const instrumentId = aliceAllocatedParty!.partyId + "#MyToken";
const tokenFactoryContractId = await getOrCreateTokenFactory(
    sdk.userLedger!,
    aliceKeyPair,
    { instrumentId, tokenFactoryTemplateId }
);

if (!tokenFactoryContractId) {
    throw new Error("Error creating or getting token factory");
}

await mintToken(sdk.userLedger!, aliceKeyPair, {
    tokenFactoryTemplateId,
    tokenFactoryContractId,
    amount: 1000,
    receiver: aliceAllocatedParty!.partyId,
});

const tokenBalance = await getBalanceByInstrumentId(sdk, {
    owner: aliceAllocatedParty!.partyId,
    instrumentId: { admin: aliceAllocatedParty!.partyId, id: instrumentId },
});

// Assume there is only one UTXO for simplicity
const tokenContractId = tokenBalance.utxos[0].contractId;

console.log({ tokenBalance });
logger.info("Preparing to transfer 500 tokens from Alice to Bob");

// TODO: FIXME fails with:
// cause: 'Interpretation error: Error: node NodeId(2) (425048c2fd2ee20ce31d06a09ba465a5223832b40bdd248f8397f9c911b14dca:MyToken:MyToken) requires authorizers b4495688-0536-426b-ae8e-454a2d67121d::12206f9345fbc89e421d1d4bb72a8b319b00259a875ae381a88baf039236c9d91806,f25ef0eb-6606-493f-9285-c09ba60d3e84::1220582708cdbebb247806670d66bb6a62a5732bb012415a44a7f6f509e44d58b38f, but only b4495688-0536-426b-ae8e-454a2d67121d::12206f9345fbc89e421d1d4bb72a8b319b00259a875ae381a88baf039236c9d91806 were given',
await transferToken(sdk.userLedger!, aliceKeyPair, {
    amount: 500,
    newOwner: bobAllocatedParty!.partyId,
    tokenTemplateId,
    tokenContractId,
});
logger.info("Transferred 500 tokens from Alice to Bob");

const utxosAfter = await sdk.tokenStandard?.listHoldingUtxos(false);
console.log({ balances: utxosAfter!.map(formatHoldingUtxo) });
