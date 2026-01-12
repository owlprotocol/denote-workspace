"use client";

import { useState, useMemo } from "react";
import { useEtfMintRecipe, type MintRecipe } from "@/lib/queries/etfMintRecipe";
import { useEtfPortfolioComposition } from "@/lib/queries/etfPortfolioComposition";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface EtfMintRecipeProps {
    partyId: string;
    partyName: string;
    allPartyIds: Record<string, string | null>;
}

export function EtfMintRecipe({
    partyId,
    partyName,
    allPartyIds,
}: EtfMintRecipeProps) {
    const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
    const [selectedComposition, setSelectedComposition] = useState("");
    const [selectedMinters, setSelectedMinters] = useState<string[]>([partyId]);

    const { get: getRecipes, create: createRecipe } = useEtfMintRecipe(partyId);
    const { get: getCompositions } = useEtfPortfolioComposition(partyId);
    const { getInstruments } = useTokenFactory(partyId);

    const recipes = getRecipes.data?.recipes ?? [];
    const compositions = getCompositions.data?.compositions ?? [];
    const instruments = getInstruments.data?.instruments ?? [];

    const getInstrumentName = (instrumentId: string) => {
        return instrumentId.split("#")[1];
    };

    const etfInstruments = useMemo(() => {
        return instruments
            .filter((inst) =>
                getInstrumentName(inst.instrumentId).includes("ETF")
            )
            .map((inst) => ({
                instrumentId: inst.instrumentId,
                name: getInstrumentName(inst.instrumentId),
            }));
    }, [instruments]);

    const availableParties = useMemo(() => {
        const parties = Object.entries(allPartyIds)
            .filter(([_, id]) => id !== null && id !== partyId)
            .map(([name, id]) => ({ name, id: id! }));
        return parties;
    }, [allPartyIds, partyId]);

    const handleToggleMinter = (partyIdToToggle: string) => {
        if (partyIdToToggle === partyId) return;

        setSelectedMinters((prev) =>
            prev.includes(partyIdToToggle)
                ? prev.filter((id) => id !== partyIdToToggle)
                : [...prev, partyIdToToggle]
        );
    };

    const getPartyName = (partyId: string) => {
        const entry = Object.entries(allPartyIds).find(
            ([_, id]) => id === partyId
        );
        return entry?.[0] ?? `${partyId.slice(0, 20)}...`;
    };

    const handleCreateRecipe = async () => {
        if (!selectedInstrumentId) {
            toast.error("Please select an ETF instrument");
            return;
        }
        if (!selectedComposition) {
            toast.error("Portfolio composition is required");
            return;
        }
        if (selectedMinters.length === 0) {
            toast.error("At least one authorized minter is required");
            return;
        }

        try {
            await createRecipe.mutateAsync({
                issuer: partyId,
                instrumentId: selectedInstrumentId,
                authorizedMinters: selectedMinters,
                composition: selectedComposition,
                seed: partyName,
            });
            toast.success("Mint recipe created successfully!");
            setSelectedComposition("");
            setSelectedMinters([partyId]);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create mint recipe"
            );
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Create Mint Recipe</CardTitle>
                    <CardDescription>
                        Define how ETF tokens can be minted based on a portfolio
                        composition
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="instrument-select">
                            ETF Instrument
                        </Label>
                        {getInstruments.isLoading ? (
                            <div className="flex items-center space-x-2 py-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm text-muted-foreground">
                                    Loading instruments...
                                </span>
                            </div>
                        ) : etfInstruments.length > 0 ? (
                            <Select
                                value={selectedInstrumentId}
                                onValueChange={setSelectedInstrumentId}
                            >
                                <SelectTrigger id="instrument-select">
                                    <SelectValue placeholder="Select an ETF instrument" />
                                </SelectTrigger>
                                <SelectContent>
                                    {etfInstruments.map((inst) => (
                                        <SelectItem
                                            key={inst.instrumentId}
                                            value={inst.instrumentId}
                                        >
                                            {inst.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="p-3 border rounded-lg border-destructive/50 bg-destructive/5">
                                <p className="text-sm text-destructive">
                                    No ETF instrument found. Please create an
                                    ETF instrument first.
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="composition-select">
                            Portfolio Composition
                        </Label>
                        <Select
                            value={selectedComposition}
                            onValueChange={setSelectedComposition}
                        >
                            <SelectTrigger id="composition-select">
                                <SelectValue placeholder="Select a composition" />
                            </SelectTrigger>
                            <SelectContent>
                                {compositions.map((comp) => (
                                    <SelectItem
                                        key={comp.contractId}
                                        value={comp.contractId}
                                    >
                                        {comp.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {compositions.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                                No compositions available. Create one first.
                            </p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label>Authorized Minters</Label>
                            <span className="text-xs text-muted-foreground">
                                {selectedMinters.length} selected
                            </span>
                        </div>

                        <div className="p-3 border rounded-lg bg-muted/30">
                            <div>
                                <p className="text-sm font-medium">
                                    {partyName} (Custodian)
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {partyId.slice(0, 30)}...
                                </p>
                            </div>
                        </div>
                        {availableParties.length > 0 ? (
                            <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                                {availableParties.map((party) => (
                                    <div
                                        key={party.id}
                                        className="flex items-center space-x-2 p-2 rounded"
                                    >
                                        <input
                                            type="checkbox"
                                            id={`minter-${party.id}`}
                                            checked={selectedMinters.includes(
                                                party.id
                                            )}
                                            onChange={() =>
                                                handleToggleMinter(party.id)
                                            }
                                            className="h-4 w-4 rounded"
                                        />
                                        <Label
                                            htmlFor={`minter-${party.id}`}
                                            className="flex-1 text-sm cursor-pointer"
                                        >
                                            {party.name}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground p-2">
                                No additional parties available
                            </p>
                        )}
                    </div>

                    <Button
                        onClick={handleCreateRecipe}
                        disabled={
                            createRecipe.isPending ||
                            !selectedInstrumentId ||
                            !selectedComposition ||
                            selectedMinters.length === 0
                        }
                        className="w-full"
                    >
                        {createRecipe.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Mint Recipe"
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Mint Recipes</CardTitle>
                    <CardDescription>
                        {recipes.length === 0
                            ? "No mint recipes created yet"
                            : `${recipes.length} recipe${
                                  recipes.length === 1 ? "" : "s"
                              } found`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {getRecipes.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : recipes.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">
                                No mint recipes have been created yet.
                            </p>
                            <p className="text-xs mt-1">
                                Create one above to get started.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {recipes.map((recipe: MintRecipe) => {
                                const instrumentName = getInstrumentName(
                                    recipe.instrumentId
                                );
                                const compositionName =
                                    compositions.find(
                                        (c) =>
                                            c.contractId === recipe.composition
                                    )?.name ?? "Unknown Composition";

                                return (
                                    <div
                                        key={recipe.contractId}
                                        className="p-4 border rounded-lg space-y-3"
                                    >
                                        <div>
                                            <h3 className="font-semibold text-base">
                                                {instrumentName}
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                {recipe.instrumentId}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Portfolio Composition
                                            </p>
                                            <p className="text-sm">
                                                {compositionName}
                                            </p>
                                            <p className="text-xs text-muted-foreground font-mono break-all">
                                                {recipe.composition}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Authorized Minters (
                                                {
                                                    recipe.authorizedMinters
                                                        .length
                                                }
                                                )
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {recipe.authorizedMinters.map(
                                                    (minter) => (
                                                        <div
                                                            key={minter}
                                                            className="px-2 py-1 bg-muted rounded text-xs"
                                                        >
                                                            {getPartyName(
                                                                minter
                                                            )}
                                                        </div>
                                                    )
                                                )}
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
