import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// An editor's panes: a file tree, two source files and a terminal.
type Types = {
    tabs: {
        files: { files: string[] };
        source: { code: string };
        terminal: undefined;
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 25,
                children: [
                    {
                        component: "files",
                        label: "Explorer",
                        data: {
                            files: [
                                "src/main.ts",
                                "src/utils.ts",
                                "src/styles.css",
                                "package.json",
                                "tsconfig.json",
                            ],
                        },
                    },
                ],
            },
            {
                type: "row",
                weight: 75,
                children: [
                    {
                        type: "tabset",
                        weight: 70,
                        children: [
                            {
                                component: "source",
                                label: "main.ts",
                                data: {
                                    code: [
                                        'import { formatTotal } from "./utils";',
                                        "",
                                        "const orders = await fetchOrders();",
                                        "console.log(formatTotal(orders));",
                                    ].join("\n"),
                                },
                            },
                            {
                                component: "source",
                                label: "utils.ts",
                                data: {
                                    code: [
                                        "export function formatTotal(orders: Order[]) {",
                                        "    const total = orders.reduce((sum, o) => sum + o.amount, 0);",
                                        '    return "$" + total.toFixed(2);',
                                        "}",
                                    ].join("\n"),
                                },
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        weight: 30,
                        children: [
                            {
                                component: "terminal",
                                label: "Terminal",
                            },
                        ],
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-splitter-hairline",
    imports: [DOCKABLE, PanelBody, LogPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <!-- every splitter of every row is the hairline splitter below -->
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <!-- The splitter, VS Code style: a 1px line (what the engine measures for the split
                         maths) with a 7px grab area that fills only while dragging or on keyboard
                         focus. \`data-orientation\` is the ARIA one: "vertical" is a bar between
                         side-by-side panes. -->
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        ></div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("files") {
                                <kit-panel-body [title]="tab.label">
                                    <ul [class]="styles.fileList">
                                        @for (file of tab.data.files; track file) {
                                            <li>{{ file }}</li>
                                        }
                                    </ul>
                                </kit-panel-body>
                            }
                            @case ("source") {
                                <pre [class]="styles.code">{{ tab.data.code }}</pre>
                            }
                            @case ("terminal") {
                                <kit-log-panel />
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
export default class SplitterHairline {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
