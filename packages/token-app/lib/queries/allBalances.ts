import { useQuery, useQueries } from "@tanstack/react-query";
import { Instrument } from "./tokenFactory";

export interface PartyBalance {
    party: string;
    total: number;
    utxos: { amount: number; contractId: string }[];
}

export function useAllBalancesByInstrumentId(
    partyId: string | null,
    instrumentId: string | null
) {
    return useQuery({
        queryKey: ["allBalances", partyId, instrumentId],
        queryFn: async () => {
            if (!partyId || !instrumentId) {
                throw new Error("Party ID and instrument ID required");
            }
            const params = new URLSearchParams({
                partyId,
                admin: partyId,
                id: instrumentId,
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

export function useAllBalancesForAllInstruments(
    partyId: string | null,
    instruments: Instrument[]
) {
    const setupInstruments = instruments.filter((inst) => inst.tokenFactoryCid);

    const balanceQueries = useQueries({
        queries: setupInstruments.map((inst) => ({
            queryKey: [
                "allBalances",
                partyId,
                { admin: partyId, id: inst.instrumentId },
            ],
            queryFn: async () => {
                const params = new URLSearchParams({
                    partyId: partyId!,
                    admin: partyId!,
                    id: inst.instrumentId,
                });
                const response = await fetch(
                    `/api/wallet/balances/all?${params}`
                );
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(
                        error.error ||
                            "Failed to get all balances by instrument ID"
                    );
                }
                return response.json() as Promise<{ balances: PartyBalance[] }>;
            },
            enabled: !!partyId && !!inst.tokenFactoryCid,
            refetchInterval: 5000,
        })),
    });

    const isLoadingBalances = balanceQueries.some((q) => q.isLoading);
    const hasBalanceError = balanceQueries.some((q) => q.isError);

    const allBalances = balanceQueries.reduce((acc: PartyBalance[], query) => {
        for (const balance of query.data?.balances || []) {
            const existing = acc.find((b) => b.party === balance.party);
            if (existing) {
                existing.total += balance.total;
                existing.utxos.push(...balance.utxos);
            } else {
                acc.push({ ...balance });
            }
        }
        return acc;
    }, []);

    return {
        allBalances,
        isLoadingBalances,
        hasBalanceError,
        setupInstruments,
    };
}
