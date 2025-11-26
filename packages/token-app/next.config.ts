import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Mark Node.js-only packages as external
    // TODO: check, build fails without it
    serverExternalPackages: ["@canton-network/wallet-sdk", "pino"],
};

export default nextConfig;
