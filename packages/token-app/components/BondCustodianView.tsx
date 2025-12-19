"use client";

import { useState, useMemo } from "react";
import { useBondInstruments } from "@/lib/queries/bondInstruments";
import {
    useBondLifecycle,
    useAllLifecycleEffects,
} from "@/lib/queries/bondLifecycle";
import {
    useQuery,
    useQueries,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface BondCustodianViewProps {
    partyId: string;
    partyName: string;
}

export function BondCustodianView({
    partyId,
    partyName,
}: BondCustodianViewProps) {
    const [bondName, setBondName] = useState("Bond");
    const [notional, setNotional] = useState("1000");
    const [couponRate, setCouponRate] = useState("0.05");
    const [couponFrequency, setCouponFrequency] = useState("2");
    const [maturityDays, setMaturityDays] = useState("10");

    const queryClient = useQueryClient();
    const bondInstrumentsQuery = useBondInstruments(partyId);
    const bondInstruments = bondInstrumentsQuery.data || [];

    const createInstrument = useMutation({
        mutationFn: async (params: {
            instrumentId: string;
            notional: number;
            couponRate: number;
            couponFrequency: number;
            maturityDate: string;
            partyId: string;
            seed: string;
            currencyInstrumentId?: string;
        }) => {
            const response = await fetch(
                "/api/wallet/bond/factory/instrument",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(params),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to create bond instrument"
                );
            }

            return response.json() as Promise<{
                bondInstrumentCid: string;
                bondFactoryCid: string;
            }>;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["bondFactory"],
            });
            queryClient.invalidateQueries({
                queryKey: ["bondInstruments"],
            });
            queryClient.invalidateQueries({
                queryKey: ["lifecycleRule"],
            });
        },
    });
    const bondLifecycle = useBondLifecycle();
    const allLifecycleEffects = useAllLifecycleEffects(partyId);

    const allBalanceQueries = useQueries({
        queries: bondInstruments.map((instrument) => ({
            queryKey: ["allBalances", partyId, instrument.instrumentId],
            queryFn: async () => {
                const params = new URLSearchParams({
                    partyId,
                    admin: partyId,
                    id: instrument.instrumentId,
                });
                const response = await fetch(
                    `/api/wallet/balances/all?${params}`
                );
                return response.json() as Promise<{
                    balances: Array<{
                        party: string;
                        total: number;
                        utxos: Array<{ amount: number; contractId: string }>;
                    }>;
                }>;
            },
            enabled: !!partyId && !!instrument.instrumentId,
        })),
    });

    const lifecycleRuleQuery = useQuery({
        queryKey: ["lifecycleRule", partyId],
        queryFn: async () => {
            const params = new URLSearchParams({
                partyId,
                seed: partyName,
            });
            const response = await fetch(
                `/api/wallet/bond/lifecycle/rule?${params}`
            );
            const data = await response.json();
            return data.lifecycleRuleCid || null;
        },
        enabled: !!partyId,
    });

    const handleCreateBondInstrument = async () => {
        try {
            const maturityDate = new Date();
            maturityDate.setSeconds(
                maturityDate.getSeconds() + parseInt(maturityDays)
            );
            const instrumentId = `${partyId}#${bondName.trim()}`;

            await createInstrument.mutateAsync({
                instrumentId,
                notional: parseFloat(notional),
                couponRate: parseFloat(couponRate),
                couponFrequency: parseInt(couponFrequency),
                maturityDate: maturityDate.toISOString(),
                partyId,
                seed: partyName,
            });
            queryClient.invalidateQueries({
                queryKey: ["allBalances"],
            });
            toast.success("Bond instrument created!");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create bond instrument"
            );
        }
    };

    const readyToProcess = useMemo(() => {
        if (!lifecycleRuleQuery.data) return [];

        const items: Array<{
            instrumentId: string;
            instrumentName: string;
            bondCid: string;
            totalOutstanding: number;
            holders: number;
            eventType: "coupon" | "redemption";
            maturityDate: Date;
        }> = [];

        bondInstruments.forEach((instrument, index) => {
            const balanceData = allBalanceQueries[index]?.data;
            if (!balanceData?.balances?.length) return;

            const firstBond = balanceData.balances
                .flatMap((b) => b.utxos)
                .find((utxo) => utxo);
            if (!firstBond) return;

            const isMatured = new Date(instrument.maturityDate) <= new Date();
            const eventType = isMatured ? "Redemption" : "CouponPayment";

            const hasEffect = allLifecycleEffects.data?.some(
                (e) =>
                    e.targetInstrumentId === instrument.instrumentId &&
                    e.eventType === eventType
            );
            if (hasEffect) return;

            const totalOutstanding = balanceData.balances.reduce(
                (sum, b) => sum + b.total,
                0
            );
            const holders = balanceData.balances.filter(
                (b) => b.total > 0
            ).length;

            items.push({
                instrumentId: instrument.instrumentId,
                instrumentName: instrument.name,
                bondCid: firstBond.contractId,
                totalOutstanding,
                holders,
                eventType: isMatured ? "redemption" : "coupon",
                maturityDate: new Date(instrument.maturityDate),
            });
        });

        return items;
    }, [
        bondInstruments,
        allBalanceQueries,
        lifecycleRuleQuery.data,
        allLifecycleEffects.data,
    ]);

    const handleProcessLifecycleEvent = async (
        instrumentId: string,
        bondCid: string,
        eventType: "coupon" | "redemption"
    ) => {
        try {
            // Fetch bond version on-demand
            const versionResponse = await fetch(
                `/api/wallet/bond/version?partyId=${partyId}&contractId=${bondCid}`
            );
            const { version } = versionResponse.ok
                ? await versionResponse.json()
                : { version: "0" };

            await bondLifecycle.processEvent.mutateAsync({
                lifecycleRuleCid: lifecycleRuleQuery.data!,
                eventType,
                targetInstrumentId: instrumentId,
                targetVersion: version,
                bondCid,
                partyId,
                seed: partyName,
            });

            queryClient.invalidateQueries({
                queryKey: ["allBalances"],
            });
            queryClient.invalidateQueries({
                queryKey: ["allLifecycleEffects", partyId],
            });
            queryClient.invalidateQueries({
                queryKey: ["bondFactory"],
            });

            toast.success(
                `${
                    eventType === "coupon" ? "Coupon payment" : "Redemption"
                } processed`
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to process lifecycle event"
            );
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create Bond Instrument</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Bond Name</Label>
                        <Input
                            value={bondName}
                            onChange={(e) => setBondName(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Notional</Label>
                            <Input
                                type="number"
                                value={notional}
                                onChange={(e) => setNotional(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Coupon Rate</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={couponRate}
                                onChange={(e) => setCouponRate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Coupon Frequency</Label>
                            <Input
                                type="number"
                                value={couponFrequency}
                                onChange={(e) =>
                                    setCouponFrequency(e.target.value)
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Maturity (seconds)</Label>
                            <Input
                                type="number"
                                value={maturityDays}
                                onChange={(e) =>
                                    setMaturityDays(e.target.value)
                                }
                            />
                        </div>
                    </div>
                    <Button
                        onClick={handleCreateBondInstrument}
                        disabled={createInstrument.isPending}
                        className="w-full"
                    >
                        {createInstrument.isPending
                            ? "Creating..."
                            : "Create Bond Instrument"}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Issued Bonds</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {bondInstruments.map((instrument) => (
                            <div
                                key={instrument.instrumentId}
                                className="p-4 border rounded-lg"
                            >
                                <p className="font-medium">{instrument.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    Rate:{" "}
                                    {(instrument.couponRate * 100).toFixed(2)}%
                                    | Freq: {instrument.couponFrequency}x |
                                    Maturity:{" "}
                                    {new Date(
                                        instrument.maturityDate
                                    ).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Process Lifecycle Events</CardTitle>
                </CardHeader>
                <CardContent>
                    {readyToProcess.length > 0 ? (
                        <div className="space-y-3">
                            {readyToProcess.map((item) => (
                                <div
                                    key={item.instrumentId}
                                    className="p-4 border rounded-lg space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">
                                                {item.instrumentName}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {item.totalOutstanding} units
                                                outstanding • {item.holders}{" "}
                                                {item.holders === 1
                                                    ? "holder"
                                                    : "holders"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Maturity:{" "}
                                                {item.maturityDate.toLocaleDateString()}
                                            </p>
                                        </div>
                                        <Button
                                            onClick={() =>
                                                handleProcessLifecycleEvent(
                                                    item.instrumentId,
                                                    item.bondCid,
                                                    item.eventType
                                                )
                                            }
                                            disabled={
                                                bondLifecycle.processEvent
                                                    .isPending
                                            }
                                            variant={
                                                item.eventType === "redemption"
                                                    ? "default"
                                                    : "outline"
                                            }
                                        >
                                            Process{" "}
                                            {item.eventType === "coupon"
                                                ? "Coupon"
                                                : "Redemption"}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No bonds ready for processing.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
