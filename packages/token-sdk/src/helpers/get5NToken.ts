interface TokenResponse5N {
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    id_token: string;
}

export async function get5NToken({
    clientId,
    clientSecret,
    audience,
}: {
    clientId: string;
    clientSecret: string;
    audience?: string;
}) {
    if (!clientId || !clientSecret) {
        throw new Error(
            "CLIENT_ID_5N and CLIENT_SECRET_5N environment variables must be set"
        );
    }

    const url = "https://auth.sandbox.fivenorth.io/application/o/token/";
    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: audience ?? clientId, // Often, audience is the client_id itself for client_credentials
        scope: "daml_ledger_api",
    }).toString();

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: body,
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(
                `HTTP error! Status: ${response.status}, Details: ${errorData}`
            );
        }

        const responseJson = (await response.json()) as TokenResponse5N;
        return responseJson.access_token;
    } catch (error) {
        console.error("Failed to obtain 5N token:", error);
        throw error;
    }
}
