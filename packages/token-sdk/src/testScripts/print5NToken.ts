import dotenv from "dotenv";
import { get5NToken } from "../helpers/get5NToken.js";

dotenv.config();

async function print5NToken() {
    const CLIENT_ID_5N = process.env.CLIENT_ID_5N ?? "";
    const CLIENT_SECRET_5N = process.env.CLIENT_SECRET_5N ?? "";

    const token = await get5NToken({
        clientId: CLIENT_ID_5N,
        clientSecret: CLIENT_SECRET_5N,
    });

    console.log(token.access_token);
}

print5NToken()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("Error in get5NToken: ", error);
        process.exit(1);
    });
