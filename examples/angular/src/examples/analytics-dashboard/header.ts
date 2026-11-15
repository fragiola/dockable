import { Component, input, output } from "@angular/core";
import type { Model } from "@fragiola/dockable-angular";
import { LucidePlus, LucideRedo2, LucideUndo2 } from "@lucide/angular";
import { DROPDOWN_MENU } from "#/components/ui/dropdown-menu";
import { SELECT_PARTS } from "#/components/ui/select";
import type { UndoManager, UndoSnapshot } from "../_kit/undo";
import { type Filters, REGIONS, type Types, WIDGETS } from "./data";
import * as styles from "./styles";

// The header OUTSIDE the layout: shared filters (read by every widget by injection), the
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

@Component({
    selector: "example-analytics-header",
    imports: [
        SELECT_PARTS,
        DROPDOWN_MENU,
        LucidePlus,
        LucideRedo2,
        LucideUndo2,
    ],
    host: { class: "contents" },
    template: `
        <header [class]="styles.header">
            <h1 [class]="styles.title">Sales overview</h1>

            <button
                [kitSelectTrigger]="regions"
                [items]="REGION_ITEMS"
                [value]="filters().region"
                (valueChange)="setFilter('region', $event)"
                aria-label="Region"
                [class]="styles.selectTrigger"
            >
                <span kitSelectValue></span>
            </button>
            <ng-template #regions>
                <div kitSelectContent>
                    @for (item of REGION_ITEMS; track item.value) {
                        <div [kitSelectItem]="item.value">{{ item.label }}</div>
                    }
                </div>
            </ng-template>

            <button
                [kitSelectTrigger]="ranges"
                [items]="RANGE_ITEMS"
                [value]="filters().months"
                (valueChange)="setFilter('months', $event)"
                aria-label="Date range"
                [class]="styles.selectTrigger"
            >
                <span kitSelectValue></span>
            </button>
            <ng-template #ranges>
                <div kitSelectContent>
                    @for (item of RANGE_ITEMS; track item.value) {
                        <div [kitSelectItem]="item.value">{{ item.label }}</div>
                    }
                </div>
            </ng-template>

            <div [class]="styles.history">
                <button
                    type="button"
                    aria-label="Undo"
                    title="Undo (Ctrl+Z)"
                    [disabled]="!history().canUndo"
                    (click)="undo().undo()"
                    [class]="styles.undoButton"
                >
                    <svg lucideUndo2 aria-hidden="true" [class]="styles.headerIcon"></svg>
                </button>
                <button
                    type="button"
                    aria-label="Redo"
                    title="Redo (Ctrl+Shift+Z)"
                    [disabled]="!history().canRedo"
                    (click)="undo().redo()"
                    [class]="styles.redoButton"
                >
                    <svg lucideRedo2 aria-hidden="true" [class]="styles.headerIcon"></svg>
                </button>
            </div>

            <button type="button" [kitDropdownMenuTrigger]="widgets" [class]="styles.addButton">
                <svg lucidePlus aria-hidden="true" [class]="styles.headerIcon"></svg>
                Add widget
            </button>
            <ng-template #widgets>
                <div kitDropdownMenuContent align="end">
                    @for (widget of WIDGETS; track widget.label; let index = $index) {
                        <div kitDropdownMenuItem (select)="addWidget(index)">{{ widget.label }}</div>
                    }
                </div>
            </ng-template>
        </header>
    `,
})
export class Header {
    readonly filters = input.required<Filters>();
    readonly filtersChange = output<Filters>();
    readonly model = input.required<Model<Types>>();
    readonly undo = input.required<UndoManager<Types>>();
    readonly history = input.required<UndoSnapshot>();
    protected readonly styles = styles;
    protected readonly REGION_ITEMS = REGION_ITEMS;
    protected readonly RANGE_ITEMS = RANGE_ITEMS;
    protected readonly WIDGETS = WIDGETS;

    protected setFilter(key: keyof Filters, value: unknown) {
        this.filtersChange.emit({ ...this.filters(), [key]: value } as Filters);
    }

    /** Adds a widget to the active tabset (or the first one) and selects it. */
    protected addWidget(index: number) {
        const model = this.model();
        const widget = WIDGETS[index];
        const target = model.get("default-tabset");
        if (!widget || !target) return;
        // no id: the model assigns a unique one
        model.run("tab.add", { ...widget.tab, to: target.id, select: true });
    }
}
