"use client";

import { useState } from "react";
import {
    useEtfPortfolioComposition,
    PortfolioItem,
} from "@/lib/queries/etfPortfolioComposition";
import { useTokenFactory } from "@/lib/queries/tokenFactory";
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
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface EtfPortfolioCompositionProps {
    partyId: string;
    partyName: string;
}

export function EtfPortfolioComposition({
    partyId,
    partyName,
}: EtfPortfolioCompositionProps) {
    const [compositionName, setCompositionName] = useState("");
    const [items, setItems] = useState<PortfolioItem[]>([]);

    const { get: getCompositions, create: createComposition } =
        useEtfPortfolioComposition(partyId);
    const { getInstruments } = useTokenFactory(partyId);
    const instruments = getInstruments.data?.instruments ?? [];

    const compositions = getCompositions.data?.compositions ?? [];

    const parseInstrumentId = (instrumentId: string) => {
        const [admin, id] = instrumentId.split("#");
        return { admin, id };
    };

    const handleAddItem = () => {
        if (instruments.length === 0) {
            toast.error(
                "No instruments available. Please create tokens first."
            );
            return;
        }

        setItems([
            ...items,
            {
                instrumentId: parseInstrumentId(instruments[0].instrumentId),
                weight: 1.0,
            },
        ]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleInstrumentChange = (index: number, instrumentId: string) => {
        setItems(
            items.map((item, i) =>
                i === index
                    ? { ...item, instrumentId: parseInstrumentId(instrumentId) }
                    : item
            )
        );
    };

    const handleWeightChange = (index: number, weight: number) => {
        setItems(
            items.map((item, i) => (i === index ? { ...item, weight } : item))
        );
    };

    const handleCreateComposition = async () => {
        if (!compositionName.trim()) {
            toast.error("Composition name is required");
            return;
        }

        if (items.length === 0) {
            toast.error("At least one portfolio item is required");
            return;
        }

        try {
            await createComposition.mutateAsync({
                owner: partyId,
                name: compositionName.trim(),
                items,
                seed: partyName,
            });
            toast.success(
                `Portfolio composition "${compositionName.trim()}" created successfully!`
            );
            setCompositionName("");
            setItems([]);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create portfolio composition"
            );
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Portfolio Compositions</CardTitle>
                    <CardDescription>
                        Create and manage portfolio compositions for ETF tokens
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="composition-name">
                            Composition Name
                        </Label>
                        <Input
                            id="composition-name"
                            value={compositionName}
                            onChange={(e) => setCompositionName(e.target.value)}
                            placeholder="e.g., Three Token ETF"
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Portfolio Items</Label>
                            <Button
                                onClick={handleAddItem}
                                size="sm"
                                variant="outline"
                                disabled={instruments.length === 0}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add Item
                            </Button>
                        </div>

                        {items.map((item, index) => (
                            <div
                                key={index}
                                className="flex gap-2 items-end p-3 border rounded-lg"
                            >
                                <div className="flex-1">
                                    <Label>Instrument</Label>
                                    <Select
                                        value={`${partyId}#${item.instrumentId.id}`}
                                        onValueChange={(value) =>
                                            handleInstrumentChange(index, value)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {instruments.map((inst) => (
                                                <SelectItem
                                                    key={inst.instrumentId}
                                                    value={inst.instrumentId}
                                                >
                                                    {
                                                        parseInstrumentId(
                                                            inst.instrumentId
                                                        ).id
                                                    }
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-32">
                                    <Label>Weight</Label>
                                    <Input
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={item.weight}
                                        onChange={(e) =>
                                            handleWeightChange(
                                                index,
                                                e.target.valueAsNumber || 0
                                            )
                                        }
                                    />
                                </div>
                                <Button
                                    onClick={() => handleRemoveItem(index)}
                                    variant="ghost"
                                    size="icon"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    <Button
                        onClick={handleCreateComposition}
                        disabled={
                            createComposition.isPending ||
                            !compositionName.trim() ||
                            items.length === 0
                        }
                        className="w-full"
                    >
                        {createComposition.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            "Create Portfolio Composition"
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Compositions</CardTitle>
                    <CardDescription>
                        {compositions.length === 0
                            ? "No portfolio compositions created yet"
                            : `${compositions.length} composition(s) found`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {getCompositions.isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {compositions.map((composition) => (
                                <div
                                    key={composition.contractId}
                                    className="p-4 border rounded-lg space-y-2"
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold">
                                            {composition.name}
                                        </h3>
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {composition.contractId.slice(
                                                0,
                                                20
                                            )}
                                            ...
                                        </code>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">
                                            Items ({composition.items.length}):
                                        </p>
                                        <ul className="text-sm space-y-1">
                                            {composition.items.map(
                                                (item, idx) => (
                                                    <li key={idx}>
                                                        •{" "}
                                                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                                            {
                                                                item
                                                                    .instrumentId
                                                                    .id
                                                            }
                                                        </code>{" "}
                                                        (weight: {item.weight})
                                                    </li>
                                                )
                                            )}
                                        </ul>
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
