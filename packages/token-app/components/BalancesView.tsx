"use client";

import { useBalance } from "@/lib/queries/balance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Instrument } from "@/lib/queries/tokenFactory";

interface BalancesViewProps {
    partyId: string | null;
    instruments: Instrument[];
}

export function BalancesView({ partyId, instruments }: BalancesViewProps) {
    const { data: balances } = useBalance(partyId);

    const balanceEntries = balances
        ? Object.entries(balances).map(([key, balance]: [string, any]) => {
              const [admin, id] = key.split(":");
              const instrumentId = id || key;
              const instrument = instruments.find(
                  (i) => i.instrumentId === instrumentId
              );
              const name =
                  instrument?.name ||
                  instrumentId.match(/^[^#]+#(.+)$/)?.[1] ||
                  instrumentId;
              return { admin, total: balance.total, instrumentName: name };
          })
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
                        {balanceEntries.map((balance, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 rounded-lg border"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        {balance.instrumentName}
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
