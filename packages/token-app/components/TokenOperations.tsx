"use client";

import { useState } from "react";
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
import { Coins, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface TokenOperationsProps {
    activePartyId?: string | null;
    activePartyName?: string | null;
}

export function TokenOperations({
    activePartyId,
    activePartyName,
}: TokenOperationsProps) {
    const [mintAmount, setMintAmount] = useState("1000");

    const instrumentId =
        activePartyId && activePartyName ? `${activePartyId}#MyToken` : "";

    const {
        data: tokenFactoryContractId,
        isLoading: isLoadingFactory,
        error: factoryError,
    } = useTokenFactory(
        instrumentId,
        activePartyName || "",
        !!(activePartyId && activePartyName)
    );

    const { data: balance, isLoading: isLoadingBalance } = useBalance(
        activePartyId || "",
        activePartyId && instrumentId
            ? { admin: activePartyId, id: instrumentId }
            : null
    );

    const mintMutation = useMintToken();

    if (!activePartyId || !activePartyName) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Coins className="h-5 w-5" />
                        Token Operations
                    </CardTitle>
                    <CardDescription>
                        Select a party to view and manage tokens
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        No party selected. Please create and select a party from
                        the Party Management section.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const handleMint = async () => {
        if (!tokenFactoryContractId || !activePartyId) {
            toast.error("Token factory or party not ready");
            return;
        }

        try {
            await mintMutation.mutateAsync({
                tokenFactoryContractId,
                receiver: activePartyId,
                amount: parseInt(mintAmount),
                seed: activePartyName,
            });
            toast.success(`Successfully minted ${mintAmount} tokens!`);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Failed to mint tokens"
            );
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    Token Operations
                </CardTitle>
                <CardDescription>Mint tokens and view balances</CardDescription>
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
                            onChange={(e) => setMintAmount(e.target.value)}
                            min="1"
                            placeholder="Enter amount"
                        />
                    </div>
                    <Button
                        onClick={handleMint}
                        disabled={
                            !tokenFactoryContractId || mintMutation.isPending
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
    );
}
