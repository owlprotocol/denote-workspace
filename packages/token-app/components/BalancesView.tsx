"use client";

import { useBalance } from "@/lib/queries/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BalancesViewProps {
    partyId: string | null;
}

export function BalancesView({ partyId }: BalancesViewProps) {
    const { data: balances } = useBalance(partyId);

    const balanceEntries = balances
        ? Object.entries(balances).map(
              ([instrumentId, balance]: [string, any]) => {
                  const [admin, id] = instrumentId.split(":");
                  return { admin, id, total: balance.total, instrumentId };
              }
          )
        : [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>All Balances</CardTitle>
            </CardHeader>
            <CardContent>
                {balanceEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No token balances found
                    </p>
                ) : (
                    <div className="space-y-2">
                        {balanceEntries.map((balance) => (
                            <div
                                key={balance.instrumentId}
                                className="flex items-center justify-between p-3 rounded-lg border"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {balance.id}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Issuer: {balance.admin}
                                    </p>
                                </div>
                                <p className="text-lg font-bold">
                                    {balance.total}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
