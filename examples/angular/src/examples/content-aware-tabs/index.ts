import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { Editor, Monitor, StatusTab } from "./parts";
import * as styles from "./styles";

// The tab follows its content. The content writes what the tab needs to know into the tab's
// `data` (with a command, so it is in the model, the JSON and the undo history); the tab reads
// `tab.data`, typed by its component, and exposes it as its own `data-*` attributes for the styles.

export type Status = "healthy" | "degraded" | "down";

export interface MonitorData {
    status: Status;
    incidents: number;
}

export interface DocumentData {
    dirty: boolean;
}

export type Types = { tabs: { monitor: MonitorData; document: DocumentData } };

const monitor = (name: string, status: Status, incidents = 0) => ({
    component: "monitor" as const,
    label: name,
    data: { status, incidents },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    monitor("API", "healthy"),
                    monitor("Database", "degraded", 2),
                    monitor("Queue", "healthy"),
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "document",
                        label: "README.md",
                        data: { dirty: false },
                    },
                    {
                        component: "document",
                        label: "notes.txt",
                        data: { dirty: false },
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-content-aware-tabs",
    imports: [DOCKABLE, StatusTab, Monitor, Editor],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" exampleStatusTab></div>
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
                        @switch (tab.component) {
                            @case ("monitor") {
                                <example-monitor [tab]="tab" />
                            }
                            @case ("document") {
                                <example-editor [tab]="tab" />
                            }
                        }
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
export default class ContentAwareTabs {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
