"use client";

import type { Model } from "@fragiola/dockable";
import { Plus, Redo2, Undo2 } from "lucide-react";

import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { Select } from "#/components/ui/select";
import { cn } from "#/lib/cn";
import type { UndoManager, UndoSnapshot } from "../_kit/undo";
import { type Filters, REGIONS, type Types, WIDGETS } from "./data";

// The header OUTSIDE the layout: shared filters (read by every widget through context), the
// "Add widget" menu (a `tab.add` command on the model), and undo/redo (the UndoManager).

const REGION_ITEMS = [
    { value: "all", label: "All regions" },
    ...REGIONS.map((region) => ({ value: region, label: region })),
];
const RANGE_ITEMS = [
    { value: 3, label: "Last 3 months" },
    { value: 6, label: "Last 6 months" },
    { value: 12, label: "Last 12 months" },
];

/** Adds a widget to the active tabset (or the first one) and selects it. */
function addWidget(model: Model<Types>, index: number) {
    const widget = WIDGETS[index];
    const target =
        model.get("active-tabset-by-layout-id") ??
        model.get("tabsets-by-layout-id")[0];
    if (!widget || !target) return;
    // no id: the model assigns a unique one
    model.run("tab.add", { ...widget.tab, to: target.id, select: true });
}

export function Header({
    filters,
    onFilters,
    model,
    undo,
    history,
}: {
    filters: Filters;
    onFilters: (filters: Filters) => void;
    model: Model<Types>;
    undo: UndoManager<Types>;
    history: UndoSnapshot<Types>;
}) {
    const selectTrigger = "h-8 w-40 py-0 text-sm";

    return (
        <header className="palette-surface flex flex-wrap items-center gap-3 border-b border-palette-line bg-palette-base px-3 py-2 text-palette-contrast">
            <h1 className="me-auto text-sm font-semibold">Sales overview</h1>

            <Select.Root
                items={REGION_ITEMS}
                value={filters.region}
                onValueChange={(region) =>
                    onFilters({
                        ...filters,
                        region: region as Filters["region"],
                    })
                }
            >
                <Select.Trigger aria-label="Region" className={selectTrigger}>
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    {REGION_ITEMS.map((item) => (
                        <Select.Item key={item.value} value={item.value}>
                            {item.label}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>

            <Select.Root
                items={RANGE_ITEMS}
                value={filters.months}
                onValueChange={(months) =>
                    onFilters({
                        ...filters,
                        months: months as Filters["months"],
                    })
                }
            >
                <Select.Trigger
                    aria-label="Date range"
                    className={selectTrigger}
                >
                    <Select.Value />
                </Select.Trigger>
                <Select.Content>
                    {RANGE_ITEMS.map((item) => (
                        <Select.Item key={item.value} value={item.value}>
                            {item.label}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>

            <div className="flex items-center">
                <button
                    type="button"
                    aria-label="Undo"
                    title="Undo (Ctrl+Z)"
                    disabled={!history.canUndo}
                    onClick={() => undo.undo()}
                    className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-md rounded-e-none border border-palette-line bg-palette-base px-2 text-sm",
                        "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                >
                    <Undo2 aria-hidden="true" className="size-4" />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    title="Redo (Ctrl+Shift+Z)"
                    disabled={!history.canRedo}
                    onClick={() => undo.redo()}
                    className={cn(
                        "-ms-px inline-flex h-8 items-center gap-1.5 rounded-md rounded-s-none border border-palette-line bg-palette-base px-2 text-sm",
                        "text-palette-contrast outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                >
                    <Redo2 aria-hidden="true" className="size-4" />
                </button>
            </div>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger
                    className={cn(
                        "palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast",
                        "outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                    )}
                >
                    <Plus aria-hidden="true" className="size-4" />
                    Add widget
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                    {WIDGETS.map((widget, index) => (
                        <DropdownMenu.Item
                            key={widget.label}
                            onClick={() => addWidget(model, index)}
                        >
                            {widget.label}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </header>
    );
}
