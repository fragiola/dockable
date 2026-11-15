import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { LucidePalette } from "@lucide/angular";
import { DROPDOWN_MENU } from "#/components/ui/dropdown-menu";
import type { ChartKind } from "../_kit/charts";
import { ScopedContent } from "./content";
import { PALETTES, paletteOf } from "./palettes";
import * as styles from "./styles";

// Fragiola palettes, scoped per tabset. A palette class sets six roles (base, soft, line,
// contrast, accent, ring) as CSS variables, and every `bg-palette-*`/`text-palette-*` inside
// reads them. Each tabset keeps its palette in its `data` (through the `tabset.configure` command,
// so it is saved with the layout); the tabset's element takes the class.
//
// A coloured palette's `base` is a strong fill, so the tabset uses the pairs its roles are made
// for: `soft` behind `accent` text, and the selected tab as a `base` chip with `contrast` text.

export type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
        note: { text: string };
        log: undefined;
    };
    tabset: { palette: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                data: { palette: "palette-blue" },
                children: [
                    {
                        component: "chart",
                        label: "Trend",
                        data: { kind: "area" },
                    },
                    {
                        component: "note",
                        label: "Notes",
                        data: {
                            text: "Pick a palette from the tabset's menu: the tabs, this panel and its charts take its colours.",
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 50,
                children: [
                    {
                        type: "tabset",
                        data: { palette: "palette-orange" },
                        children: [{ component: "log", label: "Alerts" }],
                    },
                    {
                        type: "tabset",
                        children: [
                            {
                                component: "kpi",
                                label: "Plain",
                                data: { seed: 6 },
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-scoped-palettes",
    imports: [DOCKABLE, DROPDOWN_MENU, LucidePalette, ScopedContent],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset in its own palette: soft behind accent text, the selected
                                 tab a base chip. -->
                            <div [dockableTabSet]="node" [class]="styles.tabset(paletteOf(node))">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                    <!-- The tabset's palette picker: a Fragiola dropdown menu with
                                         a radio group. -->
                                    <div [class]="styles.toolbar">
                                        <button
                                            type="button"
                                            [kitDropdownMenuTrigger]="paletteMenu"
                                            aria-label="Tabset palette"
                                            [class]="styles.button"
                                        >
                                            <svg lucidePalette aria-hidden="true" [class]="styles.buttonIcon"></svg>
                                        </button>
                                        <ng-template #paletteMenu>
                                            <div kitDropdownMenuContent align="end">
                                                <div kitDropdownMenuGroup>
                                                    <div kitDropdownMenuLabel>Palette</div>
                                                    <div
                                                        kitDropdownMenuRadioGroup
                                                        [value]="paletteOf(node)"
                                                        (valueChange)="pick(node, $event)"
                                                    >
                                                        @for (palette of PALETTES; track palette.value) {
                                                            <div [kitDropdownMenuRadioItem]="palette.value">
                                                                <span
                                                                    aria-hidden="true"
                                                                    [class]="styles.swatch(palette.value)"
                                                                ></span>
                                                                {{ palette.title }}
                                                            </div>
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        >
                            <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                        </div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <example-scoped-palettes-content [tab]="tab" />
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class ScopedPalettes {
    protected readonly styles = styles;
    protected readonly PALETTES = PALETTES;
    protected readonly paletteOf = paletteOf;
    protected readonly model = createModel<Types>(json);

    protected pick(tabset: TabsetNode<Types>, palette: unknown) {
        this.model.run("tabset.configure", {
            tabsetId: tabset.id,
            data: { ...tabset.data, palette: String(palette) },
        });
    }
}
