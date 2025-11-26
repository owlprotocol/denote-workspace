"use client";

import { useState } from "react";
import { useBalance } from "@/lib/queries/balance";
import { useIssuerMintRequest } from "@/lib/queries/issuerMintRequest";
import { useIssuerBurnRequest } from "@/lib/queries/issuerBurnRequest";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useTransferRequest } from "@/lib/queries/transferRequest";
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
import { Loader2, Coins } from "lucide-react";
import { toast } from "sonner";
import { BalancesView } from "./BalancesView";

interface UserViewProps {
    partyId: string;
    partyName: string;
    custodianPartyId: string | null;
    allPartyIds: Record<string, string | null>;
}

export function UserView({
    partyId,
    partyName,
    custodianPartyId,
    allPartyIds,
}: UserViewProps) {
    const [mintAmount, setMintAmount] = useState(100);
    const [transferAmount, setTransferAmount] = useState(10);
    const [receiverPartyId, setReceiverPartyId] = useState("");
    const [burnAmount, setBurnAmount] = useState(10);
    const [selectedBurnUtxo, setSelectedBurnUtxo] = useState("");
    const [selectedInstrumentId, setSelectedInstrumentId] = useState<
        string | null
    >(null);

    const tokenFactoryQuery = useTokenFactory(custodianPartyId);
    const instruments =
        tokenFactoryQuery.getInstruments.data?.instruments || [];

    const selectedInstrument = instruments.find(
        (i) => i.instrumentId === selectedInstrumentId
    );

    const { data: balance } = useBalance(
        partyId,
        custodianPartyId && selectedInstrumentId
            ? { admin: custodianPartyId, id: selectedInstrumentId }
            : null
    );

    const transferFactory = tokenFactoryQuery.getTransferFactory.data;

    const issuerMintRequest = useIssuerMintRequest(partyId, custodianPartyId);
    const mintRequests = issuerMintRequest.get.data;

    const transferRequest = useTransferRequest(partyId, custodianPartyId);
    const transferRequests = transferRequest.get.data;

    const transferInstruction = useTransferInstruction(partyId);
    const instructions = transferInstruction.get.data;

    const issuerBurnRequest = useIssuerBurnRequest(partyId, custodianPartyId);
    const burnRequests = issuerBurnRequest.get.data;

    const [processingId, setProcessingId] = useState<string | null>(null);

    // Get all other users (excluding current party and custodian)
    const availableReceivers = Object.entries(allPartyIds)
        .filter(
            ([name, id]) =>
                name !== partyName &&
                name !== "custodian" &&
                id &&
                id !== partyId
        )
        .map(([name, id]) => ({ name, id: id! }));

    const handleCreateMintRequest = async () => {
        if (!custodianPartyId) {
            toast.error("Custodian not available");
            return;
        }

        if (!selectedInstrumentId) {
            toast.error("Please select an instrument");
            return;
        }

        const tokenFactoryCidToUse = selectedInstrument?.tokenFactoryCid;

        if (!tokenFactoryCidToUse) {
            toast.error(
                `Token factory not set up yet for ${
                    selectedInstrument?.name || "selected instrument"
                }. Please wait for custodian to set it up.`
            );
            return;
        }

        try {
            await issuerMintRequest.create.mutateAsync({
                tokenFactoryCid: tokenFactoryCidToUse,
                issuer: custodianPartyId,
                receiver: partyId,
                amount: mintAmount,
                seed: partyName,
            });
            toast.success(
                `Mint request created for ${
                    selectedInstrument?.name || "instrument"
                }`
            );
            setMintAmount(100);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create mint request"
            );
        }
    };

    const handleCreateTransferRequest = async () => {
        if (
            !custodianPartyId ||
            !receiverPartyId ||
            !balance?.utxos.length ||
            !transferFactory?.transferFactoryCid ||
            !selectedInstrumentId
        ) {
            toast.error(
                "Missing required information. Ensure custodian has set up infrastructure and an instrument is selected."
            );
            return;
        }

        if (transferAmount <= 0 || transferAmount > (balance.total || 0)) {
            toast.error("Invalid amount");
            return;
        }

        try {
            await transferRequest.create.mutateAsync({
                transferFactoryCid: transferFactory.transferFactoryCid,
                expectedAdmin: custodianPartyId,
                sender: partyId,
                receiver: receiverPartyId,
                amount: transferAmount,
                instrumentId: {
                    admin: custodianPartyId,
                    id: selectedInstrumentId,
                },
                inputHoldingCids: [balance.utxos[0].contractId],
                seed: partyName,
            });
            toast.success("Transfer request created");
            setTransferAmount(10);
            setReceiverPartyId("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create transfer request"
            );
        }
    };

    const handleWithdrawTransfer = async (contractId: string) => {
        try {
            await transferRequest.withdraw.mutateAsync({
                contractId,
                senderPartyId: partyId,
                seed: partyName,
            });
            toast.success("Transfer request withdrawn");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to withdraw transfer request"
            );
        }
    };

    const handleAccept = async (instruction: {
        contractId: string;
        transfer: { sender: string; receiver: string; amount: number };
    }) => {
        if (!custodianPartyId) {
            toast.error("Custodian party ID required");
            return;
        }

        setProcessingId(instruction.contractId);
        try {
            const disclosureResponse =
                await transferInstruction.getDisclosure.mutateAsync({
                    transferInstructionCid: instruction.contractId,
                    adminPartyId: custodianPartyId,
                });

            const disclosure = disclosureResponse.disclosure;

            await transferInstruction.accept.mutateAsync({
                contractId: instruction.contractId,
                disclosure,
                receiverPartyId: partyId,
                seed: partyName,
            });

            toast.success("Transfer accepted successfully");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to accept transfer"
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (instruction: {
        contractId: string;
        transfer: { sender: string; receiver: string; amount: number };
    }) => {
        if (!custodianPartyId) {
            toast.error("Custodian party ID required");
            return;
        }

        setProcessingId(instruction.contractId);
        try {
            // Get disclosure from custodian
            const disclosureResponse =
                await transferInstruction.getDisclosure.mutateAsync({
                    transferInstructionCid: instruction.contractId,
                    adminPartyId: custodianPartyId,
                });

            const disclosure = disclosureResponse.disclosure;

            await transferInstruction.reject.mutateAsync({
                contractId: instruction.contractId,
                disclosure,
                receiverPartyId: partyId,
                seed: partyName,
            });

            toast.success("Transfer rejected");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to reject transfer"
            );
        } finally {
            setProcessingId(null);
        }
    };

    const handleCreateBurnRequest = async () => {
        if (!custodianPartyId) {
            toast.error("Custodian not available");
            return;
        }

        if (!selectedInstrumentId) {
            toast.error("Please select an instrument");
            return;
        }

        const tokenFactoryCidToUse = selectedInstrument?.tokenFactoryCid;

        if (!tokenFactoryCidToUse) {
            toast.error(
                `Token factory not set up yet for ${
                    selectedInstrument?.name || "selected instrument"
                }. Please wait for custodian to set it up.`
            );
            return;
        }

        if (!selectedBurnUtxo) {
            toast.error("Please select a token holding to burn");
            return;
        }

        if (burnAmount <= 0) {
            toast.error("Burn amount must be positive");
            return;
        }

        const selectedUtxo = balance?.utxos.find(
            (u) => u.contractId === selectedBurnUtxo
        );
        if (!selectedUtxo || burnAmount > selectedUtxo.amount) {
            toast.error("Insufficient tokens in selected holding");
            return;
        }

        try {
            await issuerBurnRequest.create.mutateAsync({
                tokenFactoryCid: tokenFactoryCidToUse,
                issuer: custodianPartyId,
                owner: partyId,
                amount: burnAmount,
                inputHoldingCid: selectedBurnUtxo,
                seed: partyName,
            });
            toast.success("Burn request created");
            setBurnAmount(10);
            setSelectedBurnUtxo("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create burn request"
            );
        }
    };

    const handleWithdrawBurn = async (contractId: string) => {
        try {
            await issuerBurnRequest.withdraw.mutateAsync({
                contractId,
                ownerPartyId: partyId,
                seed: partyName,
            });
            toast.success("Burn request withdrawn");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to withdraw burn request"
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
            <BalancesView partyId={partyId} instruments={instruments} />

            {instruments.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Select Instrument</CardTitle>
                        <CardDescription>
                            Choose which token instrument to use
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="instrumentSelect">Instrument</Label>
                            <select
                                id="instrumentSelect"
                                value={selectedInstrumentId || ""}
                                onChange={(e) =>
                                    setSelectedInstrumentId(
                                        e.target.value || null
                                    )
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">Select token...</option>
                                {instruments.map((instrument) => (
                                    <option
                                        key={instrument.instrumentId}
                                        value={instrument.instrumentId}
                                    >
                                        {instrument.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Mint Request</CardTitle>
                    <CardDescription>
                        Request tokens from the custodian
                        {selectedInstrument
                            ? ` for ${selectedInstrument.name}`
                            : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {instruments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No instruments available. Please wait for custodian
                            to create instruments.
                        </p>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="mintAmount">Amount</Label>
                                <Input
                                    id="mintAmount"
                                    type="number"
                                    value={mintAmount}
                                    onChange={(e) =>
                                        setMintAmount(
                                            e.target.valueAsNumber || 0
                                        )
                                    }
                                    min="1"
                                />
                            </div>
                            <Button
                                onClick={handleCreateMintRequest}
                                disabled={
                                    !custodianPartyId ||
                                    !selectedInstrumentId ||
                                    !selectedInstrument?.tokenFactoryCid ||
                                    issuerMintRequest.create.isPending
                                }
                                className="w-full"
                            >
                                {issuerMintRequest.create.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Coins className="mr-2 h-4 w-4" />
                                        Create Mint Request
                                    </>
                                )}
                            </Button>
                            {mintRequests?.requests &&
                                mintRequests.requests.length > 0 && (
                                    <div className="space-y-2">
                                        <Label>Pending Mint Requests</Label>
                                        {mintRequests.requests.map(
                                            (request) => {
                                                const requestInstrument =
                                                    instruments.find(
                                                        (i) =>
                                                            i.tokenFactoryCid ===
                                                            request.tokenFactoryCid
                                                    );
                                                return (
                                                    <div
                                                        key={request.contractId}
                                                        className="p-2 rounded border text-sm"
                                                    >
                                                        Amount: {request.amount}{" "}
                                                        tokens
                                                        {requestInstrument && (
                                                            <span className="text-blue-600 dark:text-blue-400">
                                                                {" "}
                                                                (
                                                                {
                                                                    requestInstrument.name
                                                                }
                                                                )
                                                            </span>
                                                        )}
                                                        (Pending approval)
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Transfer Request</CardTitle>
                    <CardDescription>
                        Create a transfer request to send tokens
                        {selectedInstrument
                            ? ` for ${selectedInstrument.name}`
                            : " (select an instrument first)"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="receiver">Receiver</Label>
                        {availableReceivers.length > 0 ? (
                            <select
                                id="receiver"
                                value={receiverPartyId}
                                onChange={(e) =>
                                    setReceiverPartyId(e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">Select receiver...</option>
                                {availableReceivers.map(({ name, id }) => (
                                    <option key={id} value={id}>
                                        {name} ({id.slice(0, 8)}...)
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No other parties available
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="transferAmount">Amount</Label>
                        <Input
                            id="transferAmount"
                            type="number"
                            value={transferAmount}
                            onChange={(e) =>
                                setTransferAmount(e.target.valueAsNumber || 0)
                            }
                            min="1"
                        />
                        <p className="text-xs text-muted-foreground">
                            Balance: {balance?.total ?? 0} tokens
                        </p>
                    </div>
                    <Button
                        onClick={handleCreateTransferRequest}
                        disabled={
                            !custodianPartyId ||
                            !selectedInstrumentId ||
                            !receiverPartyId ||
                            !balance?.utxos.length ||
                            !transferFactory?.transferFactoryCid ||
                            transferRequest.create.isPending
                        }
                        className="w-full"
                    >
                        {transferRequest.create.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Transfer Request"
                        )}
                    </Button>
                </CardContent>
            </Card>

            {transferRequests?.requests &&
                transferRequests.requests.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Transfer Requests</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {transferRequests.requests.map((request) => {
                                const requestInstrumentId = `${request.transfer.instrumentId.admin}#${request.transfer.instrumentId.id}`;
                                const requestInstrument = instruments.find(
                                    (i) =>
                                        i.instrumentId === requestInstrumentId
                                );
                                const instrumentName =
                                    requestInstrument?.name ||
                                    request.transfer.instrumentId.id.match(
                                        /^[^#]+#(.+)$/
                                    )?.[1] ||
                                    request.transfer.instrumentId.id;
                                const amount = Math.round(
                                    request.transfer.amount
                                );

                                return (
                                    <div
                                        key={request.contractId}
                                        className="p-3 rounded-lg border space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    To:{" "}
                                                    {request.transfer.receiver}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {amount} {instrumentName}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleWithdrawTransfer(
                                                        request.contractId
                                                    )
                                                }
                                                disabled={
                                                    transferRequest.withdraw
                                                        .isPending
                                                }
                                            >
                                                {transferRequest.withdraw
                                                    .isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Withdraw"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                )}

            <Card>
                <CardHeader>
                    <CardTitle>Pending Transfer Instructions</CardTitle>
                    <CardDescription>
                        Accept or reject incoming transfers
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {instructions?.instructions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No pending transfer instructions
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {instructions?.instructions.map((instruction) => {
                                const requestInstrumentId = `${instruction.transfer.instrumentId.admin}#${instruction.transfer.instrumentId.id}`;
                                const requestInstrument = instruments.find(
                                    (i) =>
                                        i.instrumentId === requestInstrumentId
                                );
                                const instrumentName =
                                    requestInstrument?.name ||
                                    instruction.transfer.instrumentId.id.match(
                                        /^[^#]+#(.+)$/
                                    )?.[1] ||
                                    instruction.transfer.instrumentId.id;
                                const amount = Number(
                                    instruction.transfer.amount
                                );

                                return (
                                    <div
                                        key={instruction.contractId}
                                        className="p-3 rounded-lg border space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-medium">
                                                    From:{" "}
                                                    {
                                                        instruction.transfer
                                                            .sender
                                                    }
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
                                                        handleAccept(
                                                            instruction
                                                        )
                                                    }
                                                    disabled={
                                                        processingId ===
                                                            instruction.contractId ||
                                                        transferInstruction
                                                            .accept.isPending
                                                    }
                                                >
                                                    {processingId ===
                                                        instruction.contractId &&
                                                    transferInstruction.accept
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
                                                        handleReject(
                                                            instruction
                                                        )
                                                    }
                                                    disabled={
                                                        processingId ===
                                                            instruction.contractId ||
                                                        transferInstruction
                                                            .reject.isPending
                                                    }
                                                >
                                                    {processingId ===
                                                        instruction.contractId &&
                                                    transferInstruction.reject
                                                        .isPending ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        "Reject"
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
                    <CardTitle>Burn Request</CardTitle>
                    <CardDescription>
                        Request to burn some of your tokens
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="burnHolding">
                            Select Token Holding
                        </Label>
                        {balance?.utxos && balance.utxos.length > 0 ? (
                            <select
                                id="burnHolding"
                                value={selectedBurnUtxo}
                                onChange={(e) =>
                                    setSelectedBurnUtxo(e.target.value)
                                }
                                className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            >
                                <option value="">
                                    Select a token holding...
                                </option>
                                {balance.utxos.map((utxo) => (
                                    <option
                                        key={utxo.contractId}
                                        value={utxo.contractId}
                                    >
                                        {Number(utxo.amount)}{" "}
                                        {selectedInstrument?.name || "tokens"} (
                                        {utxo.contractId.slice(0, 8)}...)
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No tokens available to burn
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="burnAmount">Amount to Burn</Label>
                        <Input
                            id="burnAmount"
                            type="number"
                            value={burnAmount}
                            onChange={(e) =>
                                setBurnAmount(e.target.valueAsNumber || 0)
                            }
                            min="1"
                            max={
                                selectedBurnUtxo
                                    ? balance?.utxos.find(
                                          (u) =>
                                              u.contractId === selectedBurnUtxo
                                      )?.amount || 0
                                    : 0
                            }
                        />
                        {selectedBurnUtxo && (
                            <p className="text-xs text-muted-foreground">
                                Available:{" "}
                                {Number(
                                    balance?.utxos.find(
                                        (u) => u.contractId === selectedBurnUtxo
                                    )?.amount || 0
                                )}{" "}
                                {selectedInstrument?.name || "tokens"}
                            </p>
                        )}
                    </div>
                    <Button
                        onClick={handleCreateBurnRequest}
                        disabled={
                            !custodianPartyId ||
                            !selectedInstrumentId ||
                            !selectedInstrument?.tokenFactoryCid ||
                            !selectedBurnUtxo ||
                            burnAmount <= 0 ||
                            issuerBurnRequest.create.isPending
                        }
                        className="w-full"
                    >
                        {issuerBurnRequest.create.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Burn Request"
                        )}
                    </Button>
                    {burnRequests?.requests &&
                        burnRequests.requests.length > 0 && (
                            <div className="space-y-2">
                                <Label>Pending Burn Requests</Label>
                                {burnRequests.requests.map((request) => {
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
                                            className="p-2 rounded border text-sm flex items-center justify-between"
                                        >
                                            <div>
                                                Amount: {amount}{" "}
                                                {instrumentName}
                                                (Pending approval)
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    handleWithdrawBurn(
                                                        request.contractId
                                                    )
                                                }
                                                disabled={
                                                    issuerBurnRequest.withdraw
                                                        .isPending
                                                }
                                            >
                                                {issuerBurnRequest.withdraw
                                                    .isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Withdraw"
                                                )}
                                            </Button>
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
