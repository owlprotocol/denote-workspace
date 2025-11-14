import { createWalletSDK, initializeSDK } from "@/lib/wallet/sdk";
import type { WalletSDK } from "@canton-network/wallet-sdk";

let sdkInstance: WalletSDK | null = null;
let initializationPromise: Promise<WalletSDK> | null = null;

export async function getSDK(): Promise<WalletSDK> {
    if (sdkInstance) {
        return sdkInstance;
    }

    // If initialization is in progress wait instead of starting a new one
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        const sdk = createWalletSDK();
        await initializeSDK(sdk);
        sdkInstance = sdk;
        return sdk;
    })();

    return initializationPromise;
}
