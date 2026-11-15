import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// What the layout holds: each tab component and the type of its data.
type Types = { tabs: { card: undefined } };

// A layout is JSON: rows split space, tabsets hold tabs. Weights are relative sizes.
const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", label: "Welcome" },
                    { component: "card", label: "Notes" },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "card", label: "Inspector" }],
            },
        ],
    },
};

@Component({
    selector: "example-hello-layout",
    imports: [DOCKABLE, Card],
    host: { class: "contents" },
    template: `
        <!-- The root needs a size: the wrapper gives it one, and the gutter around it. -->
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <!-- The layout's rows and tabsets: the developer owns the recursion. A nested row
                     renders with the same templates. -->
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset: a card with the strip of tabs on top and the measured
                                 content area below. -->
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
                    <!-- The bar between two children of a row, with a grip for the themes that
                         show one. A splitter has no name of its own: the row inserts it, so this
                         template names it. -->
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
                <!-- Every tab's content, positioned by the engine over its tabset. -->
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <kit-card [name]="tab.label" />
                    </div>
                </ng-template>
                <!-- Where a dragged tab would land; its look depends on its state. -->
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class HelloLayout {
    protected readonly styles = styles;
    // The model is the source of truth: create it once, the layout renders from it.
    protected readonly model = createModel<Types>(json);
}
