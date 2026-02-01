"use client";

import { useState } from "react";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useIssuerMintRequest } from "@/lib/queries/issuerMintRequest";
import { useIssuerBurnRequest } from "@/lib/queries/issuerBurnRequest";
import { useTransferRequest } from "@/lib/queries/transferRequest";
import {
    PartyBalance,
    useAllBalancesByInstrumentId,
    useAllBalancesForAllInstruments,
} from "@/lib/queries/allBalances";
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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CustodianViewProps {
    partyId: string;
    partyName: string;
}

export function CustodianView({ partyId, partyName }: CustodianViewProps) {
    const [tokenName, setTokenName] = useState("MyToken");
    const [setupError, setSetupError] = useState<string | null>(null);
    const [selectedInstrumentForBalances, setSelectedInstrumentForBalances] =
        useState<string | null>(null);

    const tokenFactory = useTokenFactory(partyId);
    const setupTokenFactoryMutation = tokenFactory.setup;
    const instruments = tokenFactory.getInstruments.data?.instruments || [];

    const issuerMintRequest = useIssuerMintRequest(partyId, partyId);
    const mintRequests = issuerMintRequest.get.data;

    const issuerBurnRequest = useIssuerBurnRequest(partyId, partyId);
    const burnRequests = issuerBurnRequest.get.data;

    const transferRequest = useTransferRequest(partyId, partyId);
    const transferRequests = transferRequest.get.data;

    const singleBalanceQuery = useAllBalancesByInstrumentId(
        partyId,
        selectedInstrumentForBalances
    );

    const allBalancesQuery = useAllBalancesForAllInstruments(
        partyId,
        instruments
    );

    const allBalances = selectedInstrumentForBalances
        ? singleBalanceQuery.data?.balances || []
        : allBalancesQuery.allBalances;

    const isLoadingBalances = selectedInstrumentForBalances
        ? singleBalanceQuery.isLoading
        : allBalancesQuery.isLoadingBalances;

    const hasBalanceError = selectedInstrumentForBalances
        ? singleBalanceQuery.isError
        : allBalancesQuery.hasBalanceError;

    const setupInstruments = allBalancesQuery.setupInstruments;

    const handleSetupTokenFactory = async () => {
        setSetupError(null);

        if (!tokenName.trim()) {
            setSetupError("Token name is required");
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(tokenName.trim())) {
            setSetupError(
                "Token name must contain only alphanumeric characters and underscores"
            );
            return;
        }

        try {
            await setupTokenFactoryMutation.mutateAsync({
                partyId,
                instrumentId: `${partyId}#${tokenName.trim()}`,
                seed: partyName,
            });
            toast.success(
                `Token factory setup complete for "${tokenName.trim()}"!`
            );
            setTokenName("MyToken");
            tokenFactory.getInstruments.refetch();
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to setup token factory";

            if (
                errorMessage.includes("already exists") ||
                errorMessage.includes("already set up")
            ) {
                setSetupError(`Token "${tokenName.trim()}" already exists`);
            } else {
                setSetupError(errorMessage);
            }
        }
    };

    const handleAcceptMint = async (contractId: string) => {
        try {
            await issuerMintRequest.accept.mutateAsync({
                contractId,
                issuerPartyId: partyId,
                seed: partyName,
            });
            toast.success("Mint request accepted");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept mint request"
            );
        }
    };

    const handleDeclineMint = async (contractId: string) => {
        try {
            await issuerMintRequest.decline.mutateAsync({
                contractId,
                issuerPartyId: partyId,
                seed: partyName,
            });
            toast.success("Mint request declined");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to decline mint request"
            );
        }
    };

    const handleAcceptTransfer = async (contractId: string) => {
        try {
            await transferRequest.accept.mutateAsync({
                contractId,
                adminPartyId: partyId,
                seed: partyName,
            });
            toast.success("Transfer request accepted");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept transfer request"
            );
        }
    };

    const handleDeclineTransfer = async (contractId: string) => {
        try {
            await transferRequest.decline.mutateAsync({
                contractId,
                adminPartyId: partyId,
                seed: partyName,
            });
            toast.success("Transfer request declined");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to decline transfer request"
            );
        }
    };

    const handleAcceptBurn = async (contractId: string) => {
        try {
            await issuerBurnRequest.accept.mutateAsync({
                contractId,
                issuerPartyId: partyId,
                seed: partyName,
            });
            toast.success("Burn request accepted");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept burn request"
            );
        }
    };

    const handleDeclineBurn = async (contractId: string) => {
        try {
            await issuerBurnRequest.decline.mutateAsync({
                contractId,
                issuerPartyId: partyId,
                seed: partyName,
            });
            toast.success("Burn request declined");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to decline burn request"
            );
        }
    };

    const getInstrumentForTokenFactory = (tokenFactoryCid: string) => {
        return instruments.find((i) => i.tokenFactoryCid === tokenFactoryCid);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Token Factory Setup</CardTitle>
                    <CardDescription>
                        Create all required contracts for token operations
                        (rules, transfer factory, and token factory)
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="tokenName">Token Name</Label>
                        <Input
                            id="tokenName"
                            placeholder="e.g., AAPL, GOOGL, MyToken"
                            value={tokenName}
                            onChange={(e) => {
                                setTokenName(e.target.value);
                                setSetupError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSetupTokenFactory();
                                }
                            }}
                            className={setupError ? "border-destructive" : ""}
                        />
                        {setupError ? (
                            <p className="text-xs text-destructive">
                                {setupError}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                Only alphanumeric characters and underscores
                                allowed
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleSetupTokenFactory}
                        disabled={setupTokenFactoryMutation.isPending}
                        className="w-full"
                        size="lg"
                    >
                        {setupTokenFactoryMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Setting up...
                            </>
                        ) : (
                            "Setup Token Factory"
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Minted Tokens Summary</CardTitle>
                    <CardDescription>
                        View token balances by instrument
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {setupInstruments.length > 0 && (
                        <div className="space-y-2">
                            <Label htmlFor="balanceInstrumentSelect">
                                Select Instrument
                            </Label>
                            <select
                                id="balanceInstrumentSelect"
                                value={selectedInstrumentForBalances || ""}
                                onChange={(e) =>
                                    setSelectedInstrumentForBalances(
                                        e.target.value || null
                                    )
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">All Instruments</option>
                                {setupInstruments.map((instrument) => (
                                    <option
                                        key={instrument.instrumentId}
                                        value={instrument.instrumentId}
                                    >
                                        {instrument.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {isLoadingBalances ? (
                        <p className="text-sm text-muted-foreground">
                            Loading balances...
                        </p>
                    ) : hasBalanceError ? (
                        <p className="text-sm text-muted-foreground">
                            Unable to load balances. Token factory may not be
                            set up yet.
                        </p>
                    ) : allBalances.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {selectedInstrumentForBalances
                                ? "No tokens minted yet for this instrument"
                                : "No tokens minted yet"}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {allBalances.map((balance: PartyBalance) => {
                                const selectedInstrument =
                                    selectedInstrumentForBalances
                                        ? instruments.find(
                                              (i) =>
                                                  i.instrumentId ===
                                                  selectedInstrumentForBalances
                                          )
                                        : null;

                                return (
                                    <div
                                        key={balance.party}
                                        className="p-3 rounded-lg border flex items-center justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {balance.party}
                                            </p>
                                            {selectedInstrument && (
                                                <p className="text-xs text-muted-foreground">
                                                    {selectedInstrument.name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold">
                                                {balance.total} tokens
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Mint Requests</CardTitle>
                    <CardDescription>
                        Review and approve mint requests from users
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {mintRequests?.requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No pending mint requests
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {mintRequests?.requests.map((request) => {
                                const requestInstrument =
                                    getInstrumentForTokenFactory(
                                        request.tokenFactoryCid
                                    );
                                return (
                                    <div
                                        key={request.contractId}
                                        className="p-3 rounded-lg border space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    Receiver: {request.receiver}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Amount: {request.amount}{" "}
                                                    tokens
                                                </p>
                                                {requestInstrument && (
                                                    <p className="text-xs mt-1">
                                                        Instrument:{" "}
                                                        {requestInstrument.name}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleAcceptMint(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        issuerMintRequest.accept
                                                            .isPending
                                                    }
                                                >
                                                    {issuerMintRequest.accept
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Accept"
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        handleDeclineMint(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        issuerMintRequest
                                                            .decline.isPending
                                                    }
                                                >
                                                    {issuerMintRequest.decline
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Transfer Requests</CardTitle>
                    <CardDescription>
                        Review and approve transfer requests
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {transferRequests?.requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No pending transfer requests
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {transferRequests?.requests.map((request) => {
                                const requestInstrumentId =
                                    request.transfer.instrumentId.id;
                                const requestInstrument = instruments.find(
                                    (i) =>
                                        i.instrumentId === requestInstrumentId
                                );
                                const instrumentName =
                                    requestInstrument?.name ||
                                    /^[^#]+#(.+)$/.exec(
                                        requestInstrumentId
                                    )?.[1] ||
                                    requestInstrumentId;
                                const amount = Number(request.transfer.amount);

                                return (
                                    <div
                                        key={request.contractId}
                                        className="p-3 rounded-lg border space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    {request.transfer.sender} →{" "}
                                                    {request.transfer.receiver}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {amount} {instrumentName}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleAcceptTransfer(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        transferRequest.accept
                                                            .isPending
                                                    }
                                                >
                                                    {transferRequest.accept
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Accept"
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        handleDeclineTransfer(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        transferRequest.decline
                                                            .isPending
                                                    }
                                                >
                                                    {transferRequest.decline
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Burn Requests</CardTitle>
                    <CardDescription>
                        Review and approve burn requests from users
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {burnRequests?.requests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No pending burn requests
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {burnRequests?.requests.map((request) => {
                                const requestInstrument = instruments.find(
                                    (i) =>
                                        i.tokenFactoryCid ===
                                        request.tokenFactoryCid
                                );
                                const instrumentName =
                                    requestInstrument?.name || "Unknown";
                                const amount = Number(request.amount);

                                return (
                                    <div
                                        key={request.contractId}
                                        className="p-3 rounded-lg border space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    Owner: {request.owner}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Amount: {amount}{" "}
                                                    {instrumentName}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        handleAcceptBurn(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        issuerBurnRequest.accept
                                                            .isPending
                                                    }
                                                >
                                                    {issuerBurnRequest.accept
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Accept"
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        handleDeclineBurn(
                                                            request.contractId
                                                        )
                                                    }
                                                    disabled={
                                                        issuerBurnRequest
                                                            .decline.isPending
                                                    }
                                                >
                                                    {issuerBurnRequest.decline
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
