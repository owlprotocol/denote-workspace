"use client";

import { useAcceptTransferPreapprovalProposal } from "@/lib/queries/transferPreapproval";
import { useTransferPreapprovalProposals } from "@/lib/queries/transferPreapproval";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PendingProposalsProps {
    partyId: string;
    partyName: string;
}

export function PendingProposals({
    partyId,
    partyName,
}: PendingProposalsProps) {
    const { data: receivedProposals } = useTransferPreapprovalProposals(
        partyId,
        "received"
    );

    const acceptMutation = useAcceptTransferPreapprovalProposal();

    const handleAccept = async (contractId: string) => {
        try {
            await acceptMutation.mutateAsync({
                transferPreapprovalProposalContractId: contractId,
                seed: partyName,
                receiver: partyId,
            });
            toast.success("Transfer preapproval accepted");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept proposal"
            );
        }
    };

    const handleReject = async (contractId: string) => {
        // TODO: Implement reject
        toast.info("Reject functionality not yet implemented");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pending Proposals</CardTitle>
            </CardHeader>
            <CardContent>
                {receivedProposals?.proposals?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No pending proposals
                    </p>
                ) : (
                    <div className="space-y-2">
                        {receivedProposals?.proposals?.map((proposal: any) => (
                            <div
                                key={proposal.contractId}
                                className="p-3 rounded-lg border space-y-2"
                            >
                                <div>
                                    <p className="text-sm font-medium">
                                        From: {proposal.issuer}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {proposal.instrumentId}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() =>
                                            handleAccept(proposal.contractId)
                                        }
                                        disabled={acceptMutation.isPending}
                                        size="sm"
                                        className="flex-1"
                                    >
                                        {acceptMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                Accepting...
                                            </>
                                        ) : (
                                            "Accept"
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            handleReject(proposal.contractId)
                                        }
                                        disabled={acceptMutation.isPending}
                                        className="flex-1"
                                    >
                                        <XCircle className="mr-2 h-3 w-3" />
                                        Reject
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
