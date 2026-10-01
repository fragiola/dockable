"use client";

import type { Model } from "@fragiola/dockable";
import { Plus, Redo2, Undo2 } from "lucide-react";

import { DropdownMenu } from "#/components/ui/dropdown-menu";
import { Select } from "#/components/ui/select";
import type { UndoManager, UndoSnapshot } from "../_kit/undo";
import { type Filters, REGIONS, type Types, WIDGETS } from "./data";
import * as styles from "./styles";

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
    const target = model.get("active-tabset") ?? model.get("tabsets")[0];
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
    return (
        <header className={styles.header}>
            <h1 className={styles.title}>Sales overview</h1>

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
                <Select.Trigger
                    aria-label="Region"
                    className={styles.selectTrigger}
                >
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
                    className={styles.selectTrigger}
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

            <div className={styles.history}>
                <button
                    type="button"
                    aria-label="Undo"
                    title="Undo (Ctrl+Z)"
                    disabled={!history.canUndo}
                    onClick={() => undo.undo()}
                    className={styles.undoButton}
                >
                    <Undo2 aria-hidden="true" className={styles.headerIcon} />
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    title="Redo (Ctrl+Shift+Z)"
                    disabled={!history.canRedo}
                    onClick={() => undo.redo()}
                    className={styles.redoButton}
                >
                    <Redo2 aria-hidden="true" className={styles.headerIcon} />
                </button>
            </div>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger className={styles.addButton}>
                    <Plus aria-hidden="true" className={styles.headerIcon} />
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
