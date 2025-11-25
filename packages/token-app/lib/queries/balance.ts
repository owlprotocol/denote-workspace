import { useQuery } from "@tanstack/react-query";

export interface TokenBalance {
    total: number;
    utxos: { amount: number; contractId: string }[];
}

export function useBalance(
    owner: string | null,
    instrumentId?: { admin: string; id: string } | null
) {
    return useQuery<TokenBalance>({
        queryKey: ["balances", owner, instrumentId],
        queryFn: async () => {
            if (!owner) throw new Error("Owner required");

            const params = new URLSearchParams({ owner });

            if (instrumentId?.admin && instrumentId?.id) {
                params.append("admin", instrumentId.admin);
                params.append("id", instrumentId.id);
            }

            const response = await fetch(`/api/wallet/balances?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to get balance");
            }

            return response.json() as Promise<TokenBalance>;
        },
        enabled: !!owner,
        refetchInterval: 5000,
    });
}
