"use client";

import {
    Actions,
    DockLocation,
    type IUndoSnapshot,
    type LayoutEngine,
    type Model,
    type UndoManager,
} from "@fragiola/dockable";
import { Plus, Redo2, Undo2 } from "lucide-react";
import { useRef } from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { usePopupTheme } from "../_kit/example-theme";
import * as styles from "../_kit/styles";
import { type Filters, REGIONS, WIDGETS } from "./data";

// The header OUTSIDE the layout: shared filters (read by every widget through context), the
// "Add widget" menu (an addTab action), and undo/redo (the UndoManager).

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
function addWidget(engine: LayoutEngine, model: Model, index: number) {
    const widget = WIDGETS[index];
    const target = model.getActiveTabset() ?? model.getFirstTabSet();
    if (!widget || !target) return;
    engine.doAction(
        Actions.addTab(
            { type: "tab", ...widget.tab }, // no id: the model assigns a unique one
            target.getId(),
            DockLocation.CENTER,
            -1,
            true,
        ),
    );
}

export function Header({
    filters,
    onFilters,
    engine,
    model,
    undo,
    history,
}: {
    filters: Filters;
    onFilters: (filters: Filters) => void;
    engine: LayoutEngine | null;
    model: Model;
    undo: UndoManager;
    history: IUndoSnapshot;
}) {
    const ref = useRef<HTMLElement | null>(null);
    const popupTheme = usePopupTheme(ref);
    const selectTrigger = "h-8 w-40 py-0 text-sm";

    return (
        <header ref={ref} className={cn(styles.toolbar, "gap-3")}>
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
                <Select.Content {...popupTheme}>
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
                <Select.Content {...popupTheme}>
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
                    className={cn(styles.button, "rounded-e-none px-2")}
                >
                    <Undo2 aria-hidden="true" className="size-4" />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    title="Redo (Ctrl+Shift+Z)"
                    disabled={!history.canRedo}
                    onClick={() => undo.redo()}
                    className={cn(styles.button, "-ms-px rounded-s-none px-2")}
                >
                    <Redo2 aria-hidden="true" className="size-4" />
                </button>
            </div>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger
                    disabled={!engine}
                    className={cn("palette-blue", styles.solidButton)}
                >
                    <Plus aria-hidden="true" className="size-4" />
                    Add widget
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" {...popupTheme}>
                    {WIDGETS.map((widget, index) => (
                        <DropdownMenu.Item
                            key={widget.label}
                            onClick={() =>
                                engine && addWidget(engine, model, index)
                            }
                        >
                            {widget.label}
                        </DropdownMenu.Item>
                    ))}
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </header>
    );
}
