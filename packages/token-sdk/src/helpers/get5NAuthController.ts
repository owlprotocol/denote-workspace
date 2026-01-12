import { AuthController } from "@canton-network/wallet-sdk";
import jwt from "jsonwebtoken";
import { get5NToken } from "./get5NToken.js";

export const get5NAuthController = ({
    clientId,
    clientSecret,
    audience,
}: {
    clientId: string;
    clientSecret: string;
    audience?: string;
}): AuthController => {
    audience = audience ?? clientId;

    let userAccessToken: string | undefined = undefined;

    const isJwtValid = (token: string): boolean => {
        const payload = jwt.decode(token, { json: true });
        if (!payload) return false;

        const now = Math.floor(Date.now() / 1000);
        return typeof payload.exp === "number" && payload.exp > now;
    };

    return {
        userId: clientId,
        getUserToken: async () => {
            const cachedAccessToken = userAccessToken;
            if (cachedAccessToken && isJwtValid(cachedAccessToken)) {
                return { userId: clientId, accessToken: cachedAccessToken };
            }

            const tokenResponse = await get5NToken({
                clientId,
                clientSecret,
                audience,
            });

            userAccessToken = tokenResponse.access_token;

            return {
                userId: clientId,
                accessToken: tokenResponse.access_token,
            };
        },
        getAdminToken: async () => {
            const cachedAccessToken = userAccessToken;
            if (cachedAccessToken && isJwtValid(cachedAccessToken)) {
                return { userId: clientId, accessToken: cachedAccessToken };
            }

            const tokenResponse = await get5NToken({
                clientId,
                clientSecret,
                audience,
            });

            userAccessToken = tokenResponse.access_token;

            return {
                userId: clientId,
                accessToken: tokenResponse.access_token,
            };
        },
    };
};
