import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable-angular";
import {
    LucideExternalLink,
    LucidePanelRight,
    LucideTrash2,
} from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { ChartPanel, KpiPanel } from "../_kit/charts";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";
import { ZonesTabSet } from "./tabset";
import { Zone } from "./zone";

// Drop zones: elements outside the layout that take a dragged tab. While a drag the zone takes is
// in progress it has `data-drop-active`; while the pointer is over it, `data-drop-over` (and the
// layout hides its outline). A drop emits `(dropped)` with what is dragged: nothing moves by itself,
// the zone runs the command it stands for on the model (so its middleware sees it).

export type Types = {
    tabs: {
        table: undefined;
        note: { text: string };
        chart: { seed: number };
        kpi: { seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "table", label: "Inbox" },
                    {
                        component: "note",
                        label: "Drafts",
                        data: {
                            text: "Reply to Grace about the pending order, and send Alan his invoice.",
                        },
                    },
                    // cannot be closed: the trash does not take it
                    {
                        component: "note",
                        label: "Pinned note",
                        data: {
                            text: "This tab cannot be closed: the trash does not take it.",
                        },
                        closable: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "chart",
                        label: "Calendar",
                        data: { seed: 11 },
                    },
                    { component: "kpi", label: "Contacts", data: { seed: 6 } },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`): the Pop out
// zone opens a tab in a window.
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

@Component({
    selector: "example-drop-zones",
    imports: [
        DOCKABLE,
        ZonesTabSet,
        Zone,
        PanelBody,
        ChartPanel,
        KpiPanel,
        TablePanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.frame">
                <!-- popoutMirrorRoot copies <html> and <body>'s attributes (light/dark, the
                     example theme) into each popout window, kept in sync -->
                <div
                    [dockableRoot]="model"
                    [popoutURL]="popoutURL"
                    popoutMirrorRoot
                    [class]="styles.root"
                >
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <example-drop-zones-tabset [node]="node" />
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
                                @case ("table") {
                                    <kit-table-panel />
                                }
                                @case ("note") {
                                    <kit-panel-body [title]="tab.label">
                                        <p [class]="styles.panelText">{{ tab.data.text }}</p>
                                    </kit-panel-body>
                                }
                                @case ("chart") {
                                    <kit-chart-panel kind="bar" [seed]="tab.data.seed" [title]="tab.label" />
                                }
                                @case ("kpi") {
                                    <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
                                }
                            }
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                    <!-- a popped-out tab's window: its own layout, and its own outline -->
                    <ng-template [dockablePopout]="model" let-layout>
                        <div [dockablePopoutLayout]="layout" [class]="styles.popout">
                            <div dockableRow>
                                <ng-template [dockableRowChild]="model" let-node>
                                    @if (node.type === "row") {
                                        <div [dockableRow]="node"></div>
                                    } @else {
                                        <example-drop-zones-tabset [node]="node" />
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
                            <div
                                dockableDropIndicator
                                #popoutIndicator="dockableDropIndicator"
                                [class]="styles.dropIndicator(popoutIndicator.state())"
                            ></div>
                        </div>
                    </ng-template>
                </div>
            </div>
            <!-- the zones live outside the root: they run commands on the model itself -->
            <div [class]="styles.zones">
                <!-- only tabs that may be closed -->
                <example-drop-zone
                    [model]="model"
                    zoneId="close"
                    [icon]="icons.close"
                    label="Close"
                    tone="danger"
                    [accepts]="canClose"
                    (dropped)="close($event)"
                />
                <example-drop-zone
                    [model]="model"
                    zoneId="right"
                    [icon]="icons.right"
                    label="Open to the right"
                    tone="blue"
                    (dropped)="moveRight($event)"
                />
                <example-drop-zone
                    [model]="model"
                    zoneId="popout"
                    [icon]="icons.popout"
                    label="Pop out"
                    tone="green"
                    [accepts]="canPopout"
                    (dropped)="popout($event)"
                />
                <p role="status" data-testid="status" [class]="styles.status">{{ status() }}</p>
            </div>
        </div>
    `,
})
export default class DropZones {
    protected readonly styles = styles;
    protected readonly popoutURL = popoutURL;
    protected readonly icons = {
        close: LucideTrash2,
        right: LucidePanelRight,
        popout: LucideExternalLink,
    };
    protected readonly model = createModel<Types>(json);
    protected readonly status = signal("Drag a tab onto a zone below.");

    protected readonly canClose = (tab: TabOf<Types>) =>
        this.model.can("tab.close", { tabId: tab.id });
    protected readonly canPopout = (tab: TabOf<Types>) =>
        this.model.can("tab.popout", { tabId: tab.id });

    private report(ok: boolean, describe: string) {
        if (ok) this.status.set(describe);
    }

    protected close(tab: TabOf<Types>) {
        this.report(
            this.model.run("tab.close", { tabId: tab.id }).ok,
            `Closed ${tab.label}`,
        );
    }

    protected moveRight(tab: TabOf<Types>) {
        const root = this.model.get("root-row");
        if (!root) return;
        // the end edge of the root row (the right in LTR): a new tabset there
        this.report(
            this.model.run("tab.move", {
                tabId: tab.id,
                to: root.id,
                location: "end",
            }).ok,
            `Moved ${tab.label} to the right`,
        );
    }

    protected popout(tab: TabOf<Types>) {
        this.report(
            this.model.run("tab.popout", { tabId: tab.id }).ok,
            `Popped out ${tab.label}`,
        );
    }
}
