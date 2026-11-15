import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { Card } from "../_kit/card";
import * as styles from "./styles";
import { PopoutDragTabSet } from "./tabset";

// Tabs move between windows like between tabsets: pop one out, then drag tabs into the window or
// out of it. The page's windows share one drag state, so a drag that starts in one window drops in
// another; each window draws its own outline (a DropIndicator inside Dockable.Popout, below).
// The content element moves with the tab, so the counter and the notes keep their values.

export type Types = { tabs: { card: undefined } };

const card = (name: string) => ({ component: "card" as const, label: name });

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [card("Orders"), card("Customers"), card("Invoices")],
            },
            {
                type: "tabset",
                weight: 50,
                children: [card("Chart"), card("Notes")],
            },
        ],
    },
};

@Component({
    selector: "example-popout-drag",
    imports: [DOCKABLE, Card, PopoutDragTabSet],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <!-- popoutMirrorRoot copies <html> and <body>'s attributes (light/dark, the example
                 theme) into each popout window, kept in sync -->
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
                            <example-popout-drag-tabset [node]="node" />
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
                <!-- Every tab's content, in this window or a popout, positioned by the engine. -->
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <kit-card [name]="tab.label">
                            <p [class]="styles.panelHint">
                                Pop this tab out, then drag tabs into its window, and back into
                                this one.
                            </p>
                        </kit-card>
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
                <!-- Each popout window: its own floor, rows and drop outline, moved into the
                     window once it is ready. -->
                <ng-template [dockablePopout]="model" let-layout>
                    <div [dockablePopoutLayout]="layout" [class]="styles.popout">
                        <div dockableRow>
                            <ng-template [dockableRowChild]="model" let-node>
                                @if (node.type === "row") {
                                    <div [dockableRow]="node"></div>
                                } @else {
                                    <example-popout-drag-tabset [node]="node" />
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
                        <!-- a window shows its own outline during a drag into it -->
                        <div
                            dockableDropIndicator
                            #popoutIndicator="dockableDropIndicator"
                            [class]="styles.dropIndicator(popoutIndicator.state())"
                        ></div>
                    </div>
                </ng-template>
            </div>
        </div>
    `,
})
export default class PopoutDrag {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    // The popout host page, served next to the app under its base (Vite's `BASE_URL`).
    protected readonly popoutURL = `${import.meta.env.BASE_URL}popout.html`;
}
