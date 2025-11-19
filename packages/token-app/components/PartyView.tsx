"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useBalance } from "@/lib/queries/balance";
import { useMintToken } from "@/lib/queries/mutations";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Coins, Loader2, Copy, User, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ProposalManager } from "./ProposalManager";
import { PendingProposals } from "./PendingProposals";
import { SendTransfer } from "./SendTransfer";
import { BalancesView } from "./BalancesView";

interface PartyViewProps {
    partyName: string;
    partyId: string | null;
    allPartyIds: Record<string, string | null>;
    onPartyCreated?: (partyId: string, partyName: string) => void;
}

export function PartyView({
    partyName,
    partyId,
    allPartyIds,
    onPartyCreated,
}: PartyViewProps) {
    const [mintAmount, setMintAmount] = useState(100);

    const otherPartyIds = Object.entries(allPartyIds)
        .filter(([name]) => name !== partyName)
        .map(([, id]) => id)
        .filter((id): id is string => id !== null);

    const createPartyMutation = useMutation({
        mutationFn: async (name: string) => {
            const response = await fetch("/api/wallet/party", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create party");
            }

            return response.json();
        },
        onSuccess: (data, name) => {
            onPartyCreated?.(data.partyId, name);
            toast.success(`Successfully created ${name} party`);
        },
        onError: (error, name) => {
            toast.error(
                `Failed to create ${name} party: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        },
    });

    const instrumentId = partyId ? `${partyId}#MyToken` : "";

    const {
        data: tokenFactoryContractId,
        isLoading: isLoadingFactory,
        error: factoryError,
    } = useTokenFactory(instrumentId, partyName, !!partyId);

    const { data: balance, isLoading: isLoadingBalance } = useBalance(
        partyId || "",
        partyId && instrumentId ? { admin: partyId, id: instrumentId } : null
    );

    const mintMutation = useMintToken();

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    if (!partyId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {partyName.charAt(0).toUpperCase() + partyName.slice(1)}
                    </CardTitle>
                    <CardDescription>
                        Create a party to start managing tokens
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => createPartyMutation.mutate(partyName)}
                        disabled={createPartyMutation.isPending}
                        className="w-full"
                        size="lg"
                    >
                        {createPartyMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <User className="mr-2 h-4 w-4" />
                                Create Party
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const handleMint = async () => {
        if (!tokenFactoryContractId || !partyId) {
            toast.error("Token factory or party not ready");
            return;
        }

        try {
            await mintMutation.mutateAsync({
                tokenFactoryContractId,
                receiver: partyId,
                amount: mintAmount,
                seed: partyName,
            });
            toast.success(`Successfully minted ${mintAmount} tokens!`);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to mint tokens"
            );
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                {partyName.charAt(0).toUpperCase() +
                                    partyName.slice(1)}
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Party information and status
                            </CardDescription>
                        </div>
                        <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Active
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Party ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md break-all">
                                {partyId}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(partyId!)}
                                className="shrink-0"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Coins className="h-5 w-5" />
                        Token Operations
                    </CardTitle>
                    <CardDescription>
                        Mint tokens and view balances
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Instrument ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md break-all">
                                {instrumentId}
                            </code>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => copyToClipboard(instrumentId)}
                                className="shrink-0"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label>Token Factory Contract ID</Label>
                        {isLoadingFactory ? (
                            <Skeleton className="h-10 w-full" />
                        ) : factoryError ? (
                            <div className="text-sm text-destructive">
                                Failed to load token factory
                            </div>
                        ) : tokenFactoryContractId ? (
                            <div className="flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 text-sm bg-muted rounded-md break-all">
                                    {tokenFactoryContractId}
                                </code>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                        copyToClipboard(tokenFactoryContractId)
                                    }
                                    className="shrink-0"
                                >
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Not created
                            </p>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label>Current Balance</Label>
                        {isLoadingBalance ? (
                            <Skeleton className="h-16 w-full" />
                        ) : (
                            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
                                <div className="p-2 rounded-full bg-primary/10">
                                    <Coins className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-3xl font-bold">
                                        {balance?.total ?? 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        tokens
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="mintAmount">Mint Amount</Label>
                            <Input
                                id="mintAmount"
                                type="number"
                                value={mintAmount}
                                onChange={(e) =>
                                    setMintAmount(e.target.valueAsNumber || 0)
                                }
                                min="1"
                            />
                        </div>
                        <Button
                            onClick={handleMint}
                            disabled={
                                !tokenFactoryContractId ||
                                mintMutation.isPending
                            }
                            className="w-full"
                            size="lg"
                        >
                            {mintMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Minting...
                                </>
                            ) : (
                                <>
                                    <Coins className="mr-2 h-4 w-4" />
                                    Mint Tokens
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {partyId && (
                <>
                    <ProposalManager
                        partyId={partyId}
                        partyName={partyName}
                        instrumentId={instrumentId}
                        availablePartyIds={otherPartyIds}
                    />

                    <PendingProposals partyId={partyId} partyName={partyName} />

                    <SendTransfer
                        partyId={partyId}
                        partyName={partyName}
                        instrumentId={instrumentId}
                        availablePartyIds={otherPartyIds}
                    />
                </>
            )}

            <BalancesView partyId={partyId} />
        </div>
    );
}
