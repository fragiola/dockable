import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { AddMenu } from "./add-menu";
import { FactoryContent, TEMPLATES, type Types } from "./factory";
import * as styles from "./styles";

// Tabs whose `component` field selects their content (see factory.ts). Content renders on
// demand (`renderOnDemand` on `dockablePanels`, on by default): a tab's content renders the first
// time it is shown and then stays.

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { ...TEMPLATES.chart, label: "Revenue" },
                    TEMPLATES.table,
                    {
                        component: "table",
                        label: "Pending",
                        data: { status: "Pending" },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    {
                        component: "markdown",
                        label: "README.md",
                        data: {
                            text: "# Component factory\nEach tab names a component and carries its data.\n- chart, table, markdown, form\n- add more with the + menu",
                        },
                    },
                    TEMPLATES.form,
                ],
            },
        ],
    },
};

@Component({
    selector: "example-component-factory",
    imports: [DOCKABLE, AddMenu, FactoryContent],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- a tabset: its strip of tabs with the Add menu at the end, and the
                                 measured content area -->
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                    <div [class]="styles.tabsetButtons">
                                        <example-factory-add-menu [tabset]="node" />
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
                        <example-factory-content [tab]="tab" />
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
export default class ComponentFactory {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
