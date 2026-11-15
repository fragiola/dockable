import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { CommandConsole } from "./console";
import * as styles from "./styles";

// The layout as data an assistant can drive: every change is a named command with a JSON Schema,
// so a script, a test, a chat assistant or this console can run it by name plus JSON. The console
// beside the layout lists the commands (`model.get("commands")`), runs one typed as JSON
// (`model.dispatch`), shows its result or its structured error, and logs every change
// (`model.subscribe`).

type Types = { tabs: { note: { text: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left",
                weight: 55,
                children: [
                    {
                        id: "readme",
                        component: "note",
                        label: "Readme",
                        data: {
                            text: "Run a command from the console: select, move or add a tab.",
                        },
                    },
                    {
                        id: "todo",
                        component: "note",
                        label: "Todo",
                        data: {
                            text: "Every change the console makes goes through the same bus as a drag.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 45,
                children: [
                    {
                        id: "ideas",
                        component: "note",
                        label: "Ideas",
                        data: {
                            text: "Hand the commands to an assistant as tools.",
                        },
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-command-console-page",
    imports: [DOCKABLE, PanelBody, CommandConsole],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
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
                            <kit-panel-body [title]="tab.label">
                                <p [class]="styles.panelText">{{ tab.data.text }}</p>
                                <p [class]="styles.panelId">{{ "id: " + tab.id }}</p>
                            </kit-panel-body>
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                </div>
            </div>
            <!-- outside the root: the console talks to the model only -->
            <example-command-console [model]="model" />
        </div>
    `,
})
export default class CommandConsoleExample {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
