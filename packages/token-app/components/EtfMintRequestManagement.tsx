"use client";

import { useEtfMintRequest } from "@/lib/queries/etfMintRequest";
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

export function EtfMintRequestManagement({
    partyId,
    partyName,
}: {
    partyId: string;
    partyName: string;
}) {
    const {
        get: getEtfMintRequest,
        accept: acceptEtfMintRequest,
        decline: declineEtfMintRequest,
    } = useEtfMintRequest(partyId, partyId);
    const mintRequests = getEtfMintRequest.data?.requests ?? [];

    const handleAccept = async (contractId: string) => {
        try {
            await acceptEtfMintRequest.mutateAsync({
                contractId,
                issuer: partyId,
                seed: partyName,
            });
            toast.success("ETF mint request accepted successfully!");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept ETF mint request"
            );
        }
    };

    const handleDecline = async (contractId: string) => {
        try {
            await declineEtfMintRequest.mutateAsync({
                contractId,
                issuer: partyId,
                seed: partyName,
            });
            toast.success("ETF mint request declined");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to decline ETF mint request"
            );
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>ETF Mint Requests</CardTitle>
                <CardDescription>
                    Review and approve/decline ETF mint requests from users
                </CardDescription>
            </CardHeader>
            <CardContent>
                {getEtfMintRequest.isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {mintRequests.map((mintRequest) => (
                            <div
                                key={mintRequest.contractId}
                                className="p-4 border rounded-lg space-y-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-semibold">
                                            Amount: {mintRequest.amount} ETF
                                            tokens
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Requester: {mintRequest.requester}
                                        </p>
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {mintRequest.contractId.slice(
                                                0,
                                                20
                                            )}
                                            ...
                                        </code>
                                    </div>
                                </div>
                                <div className="text-sm space-y-1">
                                    <p>
                                        Transfer Instructions:{" "}
                                        {
                                            mintRequest.transferInstructionCids
                                                .length
                                        }
                                    </p>
                                    <p>
                                        Mint Recipe:{" "}
                                        {mintRequest.mintRecipeCid.slice(0, 20)}
                                        ...
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() =>
                                            handleAccept(mintRequest.contractId)
                                        }
                                        disabled={
                                            acceptEtfMintRequest.isPending
                                        }
                                        size="sm"
                                    >
                                        {acceptEtfMintRequest.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Accept"
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            handleDecline(
                                                mintRequest.contractId
                                            )
                                        }
                                        disabled={
                                            declineEtfMintRequest.isPending
                                        }
                                        variant="destructive"
                                        size="sm"
                                    >
                                        {declineEtfMintRequest.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            "Decline"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
