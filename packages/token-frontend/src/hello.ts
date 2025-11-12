import {
    createKeyPair,
    localNetAuthDefault,
    localNetLedgerDefault,
    localNetStaticConfig,
    localNetTokenStandardDefault,
    signTransactionHash,
    WalletSDKImpl,
} from "@canton-network/wallet-sdk";
import { pino } from "pino";
import { v4 } from "uuid";

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

logger.info("Connecting to topology");
// await sdk.connectTopology(localNetStaticConfig.LOCALNET_SCAN_PROXY_API_URL);
await sdk.connectTopology(
    new URL("http://wallet.localhost:2000/api/validator")
);

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

logger.info(allocatedParty, "Create ping command for party");

const createPingCommand = sdk.userLedger?.createPingCommand(
    allocatedParty!.partyId
);

logger.info("Prepare command submission for ping create command");
const prepareResponse = await sdk.userLedger?.prepareSubmission(
    createPingCommand
);

logger.info("Sign transaction hash");

const signedCommandHash = signTransactionHash(
    prepareResponse!.preparedTransactionHash,
    keyPair.privateKey
);

logger.info("Submit command");

const response = await sdk.userLedger?.executeSubmissionAndWaitFor(
    prepareResponse!,
    signedCommandHash,
    keyPair.publicKey,
    v4()
);

logger.info(response, "Executed command submission succeeded");
