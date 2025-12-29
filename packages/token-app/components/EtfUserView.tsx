"use client";

import { useState, useMemo } from "react";
import { useEtfMintRequest } from "@/lib/queries/etfMintRequest";
import { useEtfMintRecipe } from "@/lib/queries/etfMintRecipe";
import { useTransferInstruction } from "@/lib/queries/transferInstruction";
import { useTransferRequest } from "@/lib/queries/transferRequest";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { useBalance, TokenBalance } from "@/lib/queries/balance";
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
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface EtfUserViewProps {
    partyId: string;
    partyName: string;
    custodianPartyId: string;
}

export function EtfUserView({
    partyId,
    partyName,
    custodianPartyId,
}: EtfUserViewProps) {
    const [selectedMintRecipe, setSelectedMintRecipe] = useState("");
    const [selectedTransferInstructions, setSelectedTransferInstructions] =
        useState<string[]>([]);
    const [amount, setAmount] = useState<number>(0);
    const [transferAmounts, setTransferAmounts] = useState<
        Record<string, number>
    >({
        Token1: 0,
        Token2: 0,
        Token3: 0,
    });

    const {
        get: getEtfMintRequest,
        create: createEtfMintRequest,
        withdraw: withdrawEtfMintRequest,
    } = useEtfMintRequest(partyId, custodianPartyId);
    const { get: getMintRecipe } = useEtfMintRecipe(custodianPartyId);
    const { get: getTransferInstruction } = useTransferInstruction(partyId);
    const { get: getTransferRequest, create: createTransferRequest } =
        useTransferRequest(partyId, custodianPartyId);
    const { getInstruments, getTransferFactory } =
        useTokenFactory(custodianPartyId);

    const requests = getEtfMintRequest.data?.requests || [];
    const recipes = getMintRecipe.data?.recipes ?? [];
    const instructions = getTransferInstruction.data?.instructions ?? [];
    const transferRequests = getTransferRequest.data?.requests ?? [];
    const instruments = getInstruments.data?.instruments ?? [];
    const transferFactory = getTransferFactory.data;

    const { data: allBalances, isLoading: isLoadingBalances } =
        useBalance(partyId);
    const balancesRecord =
        (allBalances as Record<string, TokenBalance>) || undefined;

    const availableInstructions = instructions.filter(
        (inst) => inst.transfer.receiver === custodianPartyId
    );

    const pendingTransferRequests = transferRequests.filter(
        (req) => req.transfer.receiver === custodianPartyId
    );

    const handleCreateRequest = async () => {
        if (
            !selectedMintRecipe ||
            selectedTransferInstructions.length === 0 ||
            amount <= 0
        ) {
            toast.error("Please fill in all fields");
            return;
        }

        try {
            await createEtfMintRequest.mutateAsync({
                mintRecipeCid: selectedMintRecipe,
                requester: partyId,
                amount,
                transferInstructionCids: selectedTransferInstructions,
                issuer: custodianPartyId,
                seed: partyName,
            });
            toast.success("ETF mint request created successfully!");
            setSelectedMintRecipe("");
            setSelectedTransferInstructions([]);
            setAmount(0);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create ETF mint request"
            );
        }
    };

    const handleWithdrawRequest = async (contractId: string) => {
        try {
            await withdrawEtfMintRequest.mutateAsync({
                contractId,
                requester: partyId,
                seed: partyName,
            });
            toast.success("ETF mint request withdrawn successfully!");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to withdraw ETF mint request"
            );
        }
    };

    const toggleTransferInstruction = (instructionId: string) => {
        setSelectedTransferInstructions((prev) =>
            prev.includes(instructionId)
                ? prev.filter((id) => id !== instructionId)
                : [...prev, instructionId]
        );
    };

    const handleCreateTransferRequest = async (instrumentId: string) => {
        const token = instruments.find(
            (inst) => inst.instrumentId === instrumentId
        );
        if (!token) return;

        const tokenName = instrumentId.split("#")[1];
        const tokenAmount = transferAmounts[tokenName];
        const balance = balancesRecord?.[instrumentId];

        if (!balance || !transferFactory?.transferFactoryCid) {
            toast.error(
                `Missing information for ${tokenName}. Ensure infrastructure is set up.`
            );
            return;
        }

        if (tokenAmount <= 0 || tokenAmount > (balance.total || 0)) {
            toast.error(`Invalid amount for ${tokenName}`);
            return;
        }

        if (!balance.utxos || balance.utxos.length === 0) {
            toast.error(`No tokens available for ${tokenName}`);
            return;
        }

        try {
            const [, tokenName] = instrumentId.split("#");

            await createTransferRequest.mutateAsync({
                transferFactoryCid: transferFactory.transferFactoryCid,
                expectedAdmin: custodianPartyId,
                sender: partyId,
                receiver: custodianPartyId,
                amount: tokenAmount,
                instrumentId: {
                    admin: custodianPartyId,
                    id: tokenName,
                },
                inputHoldingCids: [balance.utxos[0].contractId],
                seed: partyName,
            });
            toast.success(`Transfer request created for ${tokenName}`);
            setTransferAmounts((prev) => ({ ...prev, [tokenName]: 0 }));
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : `Failed to create transfer request for ${tokenName}`
            );
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Token Balances</CardTitle>
                    <CardDescription>
                        Your current balances for underlying tokens and ETF
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingBalances ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {instruments.map((token) => {
                                const tokenName = token.instrumentId.includes(
                                    "#"
                                )
                                    ? token.instrumentId.split("#")[1]
                                    : token.instrumentId;
                                const balance =
                                    balancesRecord?.[token.instrumentId];
                                const isEtf = tokenName.includes("ETF");

                                return (
                                    <div
                                        key={token.instrumentId}
                                        className={`flex items-center justify-between p-3 rounded-lg border ${
                                            isEtf ? "bg-muted" : ""
                                        }`}
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {tokenName}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {isEtf
                                                    ? "ETF Token"
                                                    : token.instrumentId}
                                            </p>
                                        </div>
                                        <p className="text-lg font-bold">
                                            {balance?.total || 0}
                                        </p>
                                    </div>
                                );
                            })}
                            {instruments.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No token balances found
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Create Transfer Requests</CardTitle>
                    <CardDescription>
                        Create transfer requests for underlying tokens to the
                        custodian. Once accepted, they become transfer
                        instructions you can use for ETF minting.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {instruments.filter((inst) => {
                        const tokenName = inst.instrumentId.includes("#")
                            ? inst.instrumentId.split("#")[1]
                            : inst.instrumentId;
                        return !tokenName.includes("ETF");
                    }).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No underlying tokens found. Ensure setup is
                            complete.
                        </p>
                    ) : (
                        instruments
                            .filter((inst) => {
                                const tokenName = inst.instrumentId.includes(
                                    "#"
                                )
                                    ? inst.instrumentId.split("#")[1]
                                    : inst.instrumentId;
                                return !tokenName.includes("ETF");
                            })
                            .map((token) => {
                                const tokenName = token.instrumentId.includes(
                                    "#"
                                )
                                    ? token.instrumentId.split("#")[1]
                                    : token.instrumentId;
                                const balance =
                                    balancesRecord?.[token.instrumentId];
                                const tokenAmount =
                                    transferAmounts[tokenName] || 0;
                                const hasBalance = balance && balance.total > 0;
                                const isPending =
                                    createTransferRequest.isPending &&
                                    createTransferRequest.variables
                                        ?.instrumentId.id === tokenName;
                                const pendingRequests =
                                    pendingTransferRequests.filter((req) => {
                                        const reqTokenName =
                                            req.transfer.instrumentId.id;
                                        const tokenTokenName =
                                            token.instrumentId.includes("#")
                                                ? token.instrumentId.split(
                                                      "#"
                                                  )[1]
                                                : token.instrumentId;
                                        return reqTokenName === tokenTokenName;
                                    });

                                return (
                                    <div
                                        key={token.instrumentId}
                                        className="p-3 border rounded space-y-2"
                                    >
                                        <div>
                                            <h3 className="font-medium">
                                                {tokenName}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                Balance: {balance?.total || 0}
                                            </p>
                                        </div>

                                        {hasBalance && (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <Input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        max={
                                                            balance?.total || 0
                                                        }
                                                        value={
                                                            tokenAmount || ""
                                                        }
                                                        onChange={(e) =>
                                                            setTransferAmounts(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [tokenName]:
                                                                        e.target
                                                                            .valueAsNumber ||
                                                                        0,
                                                                })
                                                            )
                                                        }
                                                        placeholder="Amount"
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        onClick={() =>
                                                            handleCreateTransferRequest(
                                                                token.instrumentId
                                                            )
                                                        }
                                                        disabled={
                                                            !transferFactory?.transferFactoryCid ||
                                                            tokenAmount <= 0 ||
                                                            tokenAmount >
                                                                (balance?.total ||
                                                                    0) ||
                                                            isPending
                                                        }
                                                    >
                                                        {isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            "Create Request"
                                                        )}
                                                    </Button>
                                                </div>
                                                {pendingRequests.length > 0 && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {pendingRequests.length}{" "}
                                                        pending request(s) -
                                                        waiting for custodian
                                                        acceptance
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>ETF Mint Requests</CardTitle>
                    <CardDescription>
                        Create requests to mint ETF tokens using underlying
                        assets
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="mint-recipe-select">Mint Recipe</Label>
                        <Select
                            value={selectedMintRecipe}
                            onValueChange={setSelectedMintRecipe}
                        >
                            <SelectTrigger id="mint-recipe-select">
                                <SelectValue placeholder="Select mint recipe" />
                            </SelectTrigger>
                            <SelectContent>
                                {recipes.length === 0 ? (
                                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                        No mint recipes available
                                    </div>
                                ) : (
                                    recipes.map((recipe) => {
                                        const displayName =
                                            recipe.instrumentId.includes("#")
                                                ? recipe.instrumentId.split(
                                                      "#"
                                                  )[1]
                                                : recipe.instrumentId;
                                        return (
                                            <SelectItem
                                                key={recipe.contractId}
                                                value={recipe.contractId}
                                            >
                                                {displayName} (
                                                {recipe.contractId.slice(0, 20)}
                                                ...)
                                            </SelectItem>
                                        );
                                    })
                                )}
                            </SelectContent>
                        </Select>
                        {recipes.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                No mint recipes available. Ask custodian to
                                create one.
                            </p>
                        )}
                    </div>

                    <div>
                        <Label>Transfer Instructions</Label>
                        <p className="text-xs text-muted-foreground mb-2">
                            Select transfer instructions for underlying assets
                            to be used in minting
                        </p>
                        {availableInstructions.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-3 border rounded-lg space-y-2">
                                <p>No transfer instructions available.</p>
                                <p className="text-xs">
                                    Create transfer requests in the "Create
                                    Transfer Requests" section above. Once the
                                    custodian accepts them, they will appear
                                    here as transfer instructions.
                                </p>
                                {pendingTransferRequests.length > 0 && (
                                    <p className="text-xs font-medium text-primary">
                                        {pendingTransferRequests.length}{" "}
                                        transfer request(s) pending acceptance
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                                {availableInstructions.map((instruction) => {
                                    const instrumentId = `${instruction.transfer.instrumentId.admin}#${instruction.transfer.instrumentId.id}`;
                                    const displayName = instrumentId.includes(
                                        "#"
                                    )
                                        ? instrumentId.split("#")[1]
                                        : instrumentId;
                                    const isSelected =
                                        selectedTransferInstructions.includes(
                                            instruction.contractId
                                        );
                                    return (
                                        <button
                                            key={instruction.contractId}
                                            onClick={() =>
                                                toggleTransferInstruction(
                                                    instruction.contractId
                                                )
                                            }
                                            className={`w-full flex items-center space-x-2 p-2 rounded border text-left ${
                                                isSelected
                                                    ? "bg-muted border-primary"
                                                    : "hover:bg-muted/50"
                                            }`}
                                        >
                                            <div
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                    isSelected
                                                        ? "bg-primary border-primary"
                                                        : "border-muted-foreground"
                                                }`}
                                            >
                                                {isSelected && (
                                                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">
                                                    {displayName}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Amount:{" "}
                                                    {
                                                        instruction.transfer
                                                            .amount
                                                    }{" "}
                                                    | To:{" "}
                                                    {
                                                        instruction.transfer
                                                            .receiver
                                                    }
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selectedTransferInstructions.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                {selectedTransferInstructions.length}{" "}
                                instruction(s) selected
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="amount">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.1"
                            min="0"
                            value={amount || ""}
                            onChange={(e) =>
                                setAmount(e.target.valueAsNumber || 0)
                            }
                            placeholder="e.g., 1.0"
                        />
                    </div>

                    <Button
                        onClick={handleCreateRequest}
                        disabled={
                            createEtfMintRequest.isPending ||
                            !selectedMintRecipe ||
                            selectedTransferInstructions.length === 0 ||
                            amount <= 0 ||
                            recipes.length === 0
                        }
                        className="w-full"
                    >
                        {createEtfMintRequest.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Mint Request"
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Mint Requests</CardTitle>
                    <CardDescription>
                        {requests.length === 0
                            ? "No mint requests created yet"
                            : `${requests.length} request(s) found`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {getEtfMintRequest.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {requests.map((request) => (
                                <div
                                    key={request.contractId}
                                    className="p-4 border rounded-lg space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold">
                                                Amount: {request.amount} ETF
                                                tokens
                                            </h3>
                                            <code className="text-xs bg-muted px-2 py-1 rounded">
                                                {request.contractId.slice(
                                                    0,
                                                    20
                                                )}
                                                ...
                                            </code>
                                        </div>
                                        <div className="flex gap-2">
                                            <Badge variant="outline">
                                                Pending
                                            </Badge>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    handleWithdrawRequest(
                                                        request.contractId
                                                    )
                                                }
                                                disabled={
                                                    withdrawEtfMintRequest.isPending
                                                }
                                            >
                                                {withdrawEtfMintRequest.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Withdraw"
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        <p>
                                            Transfer Instructions:{" "}
                                            {
                                                request.transferInstructionCids
                                                    .length
                                            }
                                        </p>
                                        <p>
                                            Mint Recipe:{" "}
                                            {request.mintRecipeCid.slice(0, 20)}
                                            ...
                                        </p>
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
