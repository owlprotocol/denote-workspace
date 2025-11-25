"use client";

import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useIssuerMintRequest } from "@/lib/queries/issuerMintRequest";
import { useIssuerBurnRequest } from "@/lib/queries/issuerBurnRequest";
import { useTransferRequest } from "@/lib/queries/transferRequest";
import {
    useAllBalancesByInstrumentId,
    PartyBalance,
} from "@/lib/queries/allBalances";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CustodianViewProps {
    partyId: string;
    partyName: string;
}

export function CustodianView({ partyId, partyName }: CustodianViewProps) {
    const instrumentId = `${partyId}#MyToken`;

    const tokenFactory = useTokenFactory(partyId, instrumentId);
    const setupTokenFactoryMutation = tokenFactory.setup;

    const issuerMintRequest = useIssuerMintRequest(partyId, partyId);
    const mintRequests = issuerMintRequest.get.data;

    const issuerBurnRequest = useIssuerBurnRequest(partyId, partyId);
    const burnRequests = issuerBurnRequest.get.data;

    const transferRequest = useTransferRequest(partyId, partyId);
    const transferRequests = transferRequest.get.data;

    const allBalancesQuery = useAllBalancesByInstrumentId(partyId, {
        admin: partyId,
        id: instrumentId,
    });
    const allBalances = allBalancesQuery.data?.balances || [];

    const handleSetupTokenFactory = async () => {
        try {
            await setupTokenFactoryMutation.mutateAsync({
                partyId,
                instrumentId,
                seed: partyName,
            });
            toast.success("Token factory setup complete!");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to setup token factory"
            );
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
                <CardContent>
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
                        Overview of tokens minted to each party
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {allBalancesQuery.isLoading ? (
                        <p className="text-sm text-muted-foreground">
                            Loading balances...
                        </p>
                    ) : allBalances.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No tokens minted yet
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {allBalances.map((balance: PartyBalance) => (
                                <div
                                    key={balance.party}
                                    className="p-3 rounded-lg border flex items-center justify-between"
                                >
                                    <div>
                                        <p className="text-sm font-medium">
                                            {balance.party}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold">
                                            {balance.total} tokens
                                        </p>
                                    </div>
                                </div>
                            ))}
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
                            {mintRequests?.requests.map((request) => (
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
                                                Amount: {request.amount} tokens
                                            </p>
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
                                                    issuerMintRequest.decline
                                                        .isPending
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
                            ))}
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
                            {transferRequests?.requests.map((request) => (
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
                                                Amount:{" "}
                                                {request.transfer.amount} tokens
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
                            ))}
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
                            {burnRequests?.requests.map((request) => (
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
                                                Amount: {request.amount} tokens
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
                                                    issuerBurnRequest.decline
                                                        .isPending
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
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
