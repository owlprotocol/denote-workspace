"use client";

import { useState } from "react";
import { useBalance } from "@/lib/queries/balance";
import { useBondMintRequest } from "@/lib/queries/bondMintRequest";
import {
    useAllLifecycleEffects,
    useLifecycleClaimRequest,
    useLifecycleInstruction,
} from "@/lib/queries/bondLifecycle";
import type { BondLifecycleInstruction } from "@denotecapital/token-sdk";
import { useBondInstruments } from "@/lib/queries/bondInstruments";
import { useQueryClient } from "@tanstack/react-query";
import { useTransferInstruction } from "@/lib/queries/transferInstruction";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface BondUserViewProps {
    partyId: string;
    partyName: string;
    custodianPartyId: string | null;
}

export function BondUserView({
    partyId,
    partyName,
    custodianPartyId,
}: BondUserViewProps) {
    const [selectedBondInstrumentId, setSelectedBondInstrumentId] =
        useState("");
    const [mintAmount, setMintAmount] = useState(1);

    const queryClient = useQueryClient();
    const bondInstrumentsQuery = useBondInstruments(custodianPartyId);
    const bondInstruments = bondInstrumentsQuery.data || [];
    const bondMintRequest = useBondMintRequest();
    const lifecycleClaimRequest = useLifecycleClaimRequest(
        partyId,
        custodianPartyId
    );
    const lifecycleInstruction = useLifecycleInstruction(partyId);
    const transferInstruction = useTransferInstruction(partyId);

    const selectedInstrument = bondInstruments.find(
        (inst) => inst.instrumentId === selectedBondInstrumentId
    );

    const { data: selectedBalance } = useBalance(
        partyId,
        selectedInstrument && custodianPartyId
            ? { admin: custodianPartyId, id: selectedInstrument.instrumentId }
            : null
    );

    const allLifecycleEffects = useAllLifecycleEffects(custodianPartyId);

    const currencyInstrumentId = custodianPartyId
        ? `${custodianPartyId}#Currency`
        : null;
    const { data: currencyBalance } = useBalance(
        partyId,
        custodianPartyId && currencyInstrumentId
            ? { admin: custodianPartyId, id: currencyInstrumentId }
            : null
    );

    const handleCreateBondMintRequest = async () => {
        if (!selectedInstrument) {
            toast.error("Please select a bond instrument");
            return;
        }

        try {
            await bondMintRequest.create.mutateAsync({
                instrumentCid: selectedInstrument.bondInstrumentCid,
                issuer: custodianPartyId!,
                receiver: partyId,
                amount: mintAmount,
                seed: partyName,
            });
            queryClient.invalidateQueries({
                queryKey: ["balances", partyId],
            });
            toast.success(
                `Bond mint request created for ${mintAmount} bond(s)`
            );
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create bond mint request"
            );
        }
    };

    const handleClaimLifecycleEvent = async (effectCid: string) => {
        if (!selectedInstrument) {
            toast.error("Please select a bond first");
            return;
        }

        const effect = allLifecycleEffects.data?.find(
            (e) => e.contractId === effectCid
        );
        if (!effect) {
            toast.error("Invalid effect");
            return;
        }

        try {
            const params = new URLSearchParams({
                owner: partyId,
                admin: custodianPartyId!,
                id: selectedInstrument.instrumentId,
            });
            const balanceResponse = await fetch(
                `/api/wallet/balances?${params}`
            );
            if (!balanceResponse.ok) {
                const error = await balanceResponse.json().catch(() => ({}));
                toast.error(error.error || "Failed to fetch balance");
                return;
            }
            const balance = await balanceResponse.json();
            if (!balance?.utxos?.length) {
                toast.error("No bonds available");
                return;
            }

            let matchingBond = null;
            for (const utxo of balance.utxos) {
                const versionRes = await fetch(
                    `/api/wallet/bond/version?partyId=${partyId}&contractId=${utxo.contractId}`
                );
                const { version } = versionRes.ok
                    ? await versionRes.json()
                    : { version: "0" };
                if (version === effect.targetVersion) {
                    matchingBond = utxo;
                    break;
                }
            }

            if (!matchingBond) {
                toast.error("No bonds with matching version");
                return;
            }

            const currencyInstrumentId = `${custodianPartyId}#Currency`;
            const [disclosureRes, infraRes] = await Promise.all([
                fetch(
                    `/api/wallet/bond/disclosure?bondInstrumentCid=${selectedInstrument.bondInstrumentCid}&adminPartyId=${custodianPartyId}`
                ),
                fetch(
                    `/api/wallet/bond/lifecycle/infrastructure?partyId=${encodeURIComponent(
                        custodianPartyId!
                    )}&currencyInstrumentId=${encodeURIComponent(
                        currencyInstrumentId
                    )}&seed=custodian`
                ),
            ]);

            const { disclosure } = await disclosureRes.json();
            const infrastructure = await infraRes.json();

            await lifecycleClaimRequest.create.mutateAsync({
                effectCid,
                bondHoldingCid: matchingBond.contractId,
                bondRulesCid: infrastructure.bondRulesCid,
                bondInstrumentCid: selectedInstrument.bondInstrumentCid,
                currencyTransferFactoryCid:
                    infrastructure.currencyTransferFactoryCid,
                issuerCurrencyHoldingCid: infrastructure.currencyHoldings[0],
                holder: partyId,
                issuer: custodianPartyId!,
                seed: partyName,
                disclosure,
            });

            queryClient.invalidateQueries({
                queryKey: ["lifecycleInstruction"],
            });
            queryClient.invalidateQueries({
                queryKey: ["lifecycleClaimRequests"],
            });
            queryClient.invalidateQueries({
                queryKey: ["allLifecycleEffects"],
            });
            toast.success("Claim request created!");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to claim"
            );
        }
    };

    const handleProcessInstruction = async (
        instruction: BondLifecycleInstruction
    ) => {
        try {
            let disclosure = undefined;
            if (
                instruction.eventType === "CouponPayment" &&
                instruction.bondInstrumentCid
            ) {
                const res = await fetch(
                    `/api/wallet/bond/disclosure?bondInstrumentCid=${instruction.bondInstrumentCid}&adminPartyId=${custodianPartyId}`
                );
                disclosure = (await res.json()).disclosure;
            }

            await lifecycleInstruction.process.mutateAsync({
                contractId: instruction.contractId,
                partyId,
                seed: partyName,
                disclosure,
            });

            if (custodianPartyId) {
                const transferRes = await fetch(
                    `/api/wallet/transfer-instruction?partyId=${partyId}`
                );
                if (transferRes.ok) {
                    const { instructions } = await transferRes.json();
                    const currencyTransfer = instructions?.find(
                        (inst: {
                            transfer: {
                                instrumentId: { admin: string; id: string };
                            };
                        }) =>
                            inst.transfer.instrumentId.admin ===
                                custodianPartyId &&
                            inst.transfer.instrumentId.id.includes("Currency")
                    );

                    if (currencyTransfer) {
                        const disclosureRes =
                            await transferInstruction.getDisclosure.mutateAsync(
                                {
                                    transferInstructionCid:
                                        currencyTransfer.contractId,
                                    adminPartyId: custodianPartyId,
                                }
                            );

                        await transferInstruction.accept.mutateAsync({
                            contractId: currencyTransfer.contractId,
                            disclosure: disclosureRes.disclosure,
                            receiverPartyId: partyId,
                            seed: partyName,
                        });
                    }
                }
            }

            queryClient.invalidateQueries({
                queryKey: ["allLifecycleInstructions"],
            });
            queryClient.invalidateQueries({ queryKey: ["balances"] });
            queryClient.invalidateQueries({
                queryKey: ["transferInstructions"],
            });
            toast.success("Instruction processed!");
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to process"
            );
        }
    };

    if (!custodianPartyId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Setup Required</CardTitle>
                    <CardDescription>
                        Please create the custodian party first
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Select Bond</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label>Bond Instrument</Label>
                        {bondInstruments.length > 0 ? (
                            <Select
                                value={selectedBondInstrumentId}
                                onValueChange={setSelectedBondInstrumentId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a bond" />
                                </SelectTrigger>
                                <SelectContent>
                                    {bondInstruments.map((instrument) => (
                                        <SelectItem
                                            key={instrument.instrumentId}
                                            value={instrument.instrumentId}
                                        >
                                            {instrument.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={selectedBondInstrumentId}
                                onChange={(e) =>
                                    setSelectedBondInstrumentId(e.target.value)
                                }
                                placeholder={`${custodianPartyId}#Bond`}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            {!selectedInstrument && (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-muted-foreground text-center">
                            Please select a bond to continue
                        </p>
                    </CardContent>
                </Card>
            )}

            {selectedInstrument && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Balances</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedBalance && (
                                <div className="p-3 border rounded-lg">
                                    <p className="text-sm font-medium">Bonds</p>
                                    <p className="text-2xl font-bold">
                                        {selectedBalance.total || 0}
                                    </p>
                                </div>
                            )}
                            {currencyBalance && (
                                <div className="p-3 border rounded-lg">
                                    <p className="text-sm font-medium">
                                        Currency
                                    </p>
                                    <p className="text-2xl font-bold">
                                        {currencyBalance.total || 0}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Mint Bonds</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input
                                    type="number"
                                    value={mintAmount}
                                    onChange={(e) =>
                                        setMintAmount(
                                            parseFloat(e.target.value) || 0
                                        )
                                    }
                                />
                            </div>
                            <Button
                                onClick={handleCreateBondMintRequest}
                                disabled={
                                    bondMintRequest.create.isPending ||
                                    !selectedInstrument
                                }
                                className="w-full"
                            >
                                {bondMintRequest.create.isPending
                                    ? "Creating..."
                                    : "Create Mint Request"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Claim Lifecycle Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!allLifecycleEffects.data?.length ? (
                                <p className="text-sm text-muted-foreground">
                                    No lifecycle effects available.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {allLifecycleEffects.data
                                        .filter((e) => {
                                            // Must match selected bond
                                            if (
                                                e.targetInstrumentId !==
                                                selectedBondInstrumentId
                                            )
                                                return false;

                                            // Check if instruction exists (indicates effect was already claimed/processed)
                                            const hasInstruction =
                                                lifecycleInstruction.getAll.data?.some(
                                                    (i) =>
                                                        i.eventType ===
                                                            e.eventType &&
                                                        i.eventDate ===
                                                            e.eventDate &&
                                                        i.holder === partyId
                                                );
                                            if (hasInstruction) return false;

                                            // Check if there's a pending claim request
                                            const hasPending =
                                                lifecycleClaimRequest.get.data?.requests?.some(
                                                    (r) =>
                                                        r.effectCid ===
                                                        e.contractId
                                                );
                                            if (hasPending) return false;

                                            return true;
                                        })
                                        .map((effect) => (
                                            <div
                                                key={effect.contractId}
                                                className="p-3 border rounded-lg flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {effect.eventType ===
                                                        "CouponPayment"
                                                            ? "Coupon"
                                                            : "Redemption"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {effect.amount} per unit
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() =>
                                                        handleClaimLifecycleEvent(
                                                            effect.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        lifecycleClaimRequest
                                                            .create.isPending
                                                    }
                                                    size="sm"
                                                >
                                                    Claim
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Process Lifecycle Instructions
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!selectedInstrument ? (
                                <p className="text-sm text-muted-foreground">
                                    Please select a bond first.
                                </p>
                            ) : !lifecycleInstruction.getAll.data?.length ? (
                                <p className="text-sm text-muted-foreground">
                                    No instructions available.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {lifecycleInstruction.getAll.data
                                        ?.filter((i) => i.holder === partyId)
                                        .map((instruction) => (
                                            <div
                                                key={instruction.contractId}
                                                className="p-3 border rounded-lg flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="text-sm font-medium">
                                                        {instruction.eventType ===
                                                        "CouponPayment"
                                                            ? "Coupon"
                                                            : "Redemption"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {instruction.amount} per
                                                        unit
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() =>
                                                        handleProcessInstruction(
                                                            instruction
                                                        )
                                                    }
                                                    disabled={
                                                        lifecycleInstruction
                                                            .process.isPending
                                                    }
                                                    size="sm"
                                                >
                                                    Process
                                                </Button>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
