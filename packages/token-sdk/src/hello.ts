import { PrettyContract, Holding } from "@canton-network/core-ledger-client";
import {
    createKeyPair,
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetTokenStandardDefault,
    signTransactionHash,
    WalletSDKImpl,
    WrappedCommand,
} from "@canton-network/wallet-sdk";
import { pino } from "pino";
import { v4 } from "uuid";
import { getOrCreateTokenFactory } from "./helpers.js";

const logger = pino({ name: "token-frontend", level: "info" });

const sdk = new WalletSDKImpl().configure({
    logger,
    authFactory: localNetAuthDefault,
    ledgerFactory: localNetLedgerDefault,
    tokenStandardFactory: localNetTokenStandardDefault,
});

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

const keyPair = createKeyPair();

logger.info("Generating external party");
const generatedParty = await sdk.userLedger?.generateExternalParty(
    keyPair.publicKey
);

if (!generatedParty) {
    throw new Error("Error creating prepared party");
}

logger.info("Signing the hash");
const signedHash = signTransactionHash(
    generatedParty.multiHash,
    keyPair.privateKey
);

const allocatedParty = await sdk.userLedger?.allocateExternalParty(
    signedHash,
    generatedParty
);

logger.info({ partyId: allocatedParty!.partyId }, "Allocated party");
await sdk.setPartyId(allocatedParty!.partyId);

// TODO: only create the token factory if it doesn't already exist

const tokenFactoryTemplateId = "#minimal-token:MyTokenFactory:MyTokenFactory";
const instrumentId = allocatedParty!.partyId + "#MyToken";
const tokenFactoryContractId = await getOrCreateTokenFactory(
    sdk.userLedger!,
    keyPair,
    { instrumentId, tokenFactoryTemplateId }
);

if (!tokenFactoryContractId) {
    throw new Error("Error creating or getting token factory");
}

const mintTokenCommand: WrappedCommand = {
    ExerciseCommand: {
        templateId: tokenFactoryTemplateId,
        contractId: tokenFactoryContractId,
        choice: "Mint",
        choiceArgument: {
            receiver: allocatedParty!.partyId,
            amount: 1000,
        },
    },
};

const prepareMintTokenResponse = await sdk.userLedger?.prepareSubmission(
    mintTokenCommand
);
logger.info("Prepared Mint Token Command");

const signedMintTokenCommandHash = signTransactionHash(
    prepareMintTokenResponse!.preparedTransactionHash,
    keyPair.privateKey
);

await sdk.userLedger?.executeSubmissionAndWaitFor(
    prepareMintTokenResponse!,
    signedMintTokenCommandHash,
    keyPair.publicKey,
    v4()
);

logger.info("Minted Token");

// Holding transactions of allocatedParty
const holdingTransactions = await sdk.tokenStandard?.listHoldingTransactions();
console.log({ holdingTransactions: holdingTransactions?.transactions });

const utxos = await sdk.tokenStandard?.listHoldingUtxos(false);

const formatHoldingUtxo = (utxo: PrettyContract<Holding>) => {
    const view = utxo.interfaceViewValue;
    const { amount, owner } = view;
    return {
        amount,
        owner,
        instrumentId: view.instrumentId.id,
    };
};
console.log({ balances: utxos!.map(formatHoldingUtxo) });
