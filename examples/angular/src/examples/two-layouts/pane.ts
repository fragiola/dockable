import { Component, input } from "@angular/core";
import { DOCKABLE, type Model } from "@fragiola/dockable-angular";
import { Card } from "../_kit/card";
import type { Types } from "./index";
import * as styles from "./styles";

/** One of the two layouts, with its own model. */
@Component({
    selector: "example-two-layouts-pane",
    imports: [DOCKABLE, Card],
    host: { class: "contents" },
    template: `
        <section
            [attr.aria-label]="title()"
            [attr.data-testid]="'pane-' + title().toLowerCase()"
            [class]="styles.pane"
        >
            <h2 [class]="styles.paneTitle">{{ title() }}</h2>
            <div [class]="styles.frame">
                <div [dockableRoot]="model()" [class]="styles.root">
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model()" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <div [dockableTabSet]="node" [class]="styles.tabset">
                                    <div [class]="styles.strip">
                                        <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                            <ng-template [dockableTabListItem]="model()" let-tab>
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
                    <ng-template [dockablePanels]="model()" let-tab>
                        <div [dockablePanel]="tab" [class]="styles.panel">
                            <kit-card [name]="tab.label" />
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                </div>
            </div>
        </section>
    `,
})
export class Pane {
    readonly title = input.required<string>();
    readonly model = input.required<Model<Types>>();
    protected readonly styles = styles;
}
