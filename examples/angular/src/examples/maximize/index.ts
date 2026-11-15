import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { ChartPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import { MaximizeButton, RestoreOnEscape, toggleMaximize } from "./parts";
import * as styles from "./styles";

// Maximize a tabset three ways: its header button, a double-click on the empty part of its strip,
// and Escape to restore. The styles read `data-maximized` (on the tabset and on the root); the
// splitters hide themselves while a tabset is maximized.

export type Types = {
    tabs: {
        chart: undefined;
        bars: undefined;
        table: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "chart", label: "Revenue" },
                    { component: "table", label: "Orders" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "bars", label: "Signups" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "table", label: "Latest" }],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-maximize",
    imports: [
        DOCKABLE,
        ChartPanel,
        TablePanel,
        MaximizeButton,
        RestoreOnEscape,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset: the strip and its maximize button on top, the measured
                                 content area below. The maximized tabset is outlined and its header
                                 highlighted; a double-click on the header (not on a tab or a button)
                                 toggles; the button is the accessible way. -->
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip" (dblclick)="onStripDoubleClick($event, node.id)">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                    <div [class]="styles.toolbar">
                                        <example-maximize-button [tabset]="node" />
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
                        @switch (tab.component) {
                            @case ("chart") {
                                <kit-chart-panel kind="area" [seed]="3" />
                            }
                            @case ("bars") {
                                <kit-chart-panel kind="bar" [seed]="19" />
                            }
                            @case ("table") {
                                <kit-table-panel />
                            }
                        }
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
                <example-restore-on-escape />
            </div>
        </div>
    `,
})
export default class Maximize {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);

    protected onStripDoubleClick(event: MouseEvent, tabsetId: string) {
        const target = event.target as Element;
        if (!target.closest('[role="tab"], button')) {
            toggleMaximize(this.model, tabsetId);
        }
    }
}
