import { useQuery } from "@tanstack/react-query";

export interface PartyBalance {
    party: string;
    total: number;
    utxos: { amount: number; contractId: string }[];
}

export function useAllBalancesByInstrumentId(
    partyId: string | null,
    instrumentId: { admin: string; id: string } | null
) {
    return useQuery({
        queryKey: ["allBalances", partyId, instrumentId],
        queryFn: async () => {
            if (!partyId || !instrumentId)
                throw new Error("Party ID and instrument ID required");

            const params = new URLSearchParams({
                partyId,
                admin: instrumentId.admin,
                id: instrumentId.id,
            });

            const response = await fetch(`/api/wallet/balances/all?${params}`);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to get all balances by instrument ID"
                );
            }

            return response.json() as Promise<{
                balances: PartyBalance[];
            }>;
        },
        enabled: !!partyId && !!instrumentId,
        refetchInterval: 5000,
    });
}
