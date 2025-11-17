import nacl from "tweetnacl";
import naclUtil from "tweetnacl-util";

export const keyPairFromSeed = (seed: string) => {
    const pair = nacl.sign.keyPair.fromSeed(Buffer.from(seed.padEnd(32, "0")));
    return {
        publicKey: naclUtil.encodeBase64(pair.publicKey),
        privateKey: naclUtil.encodeBase64(pair.secretKey),
    };
};
