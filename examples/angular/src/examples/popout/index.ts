import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { Card } from "../_kit/card";
import * as styles from "./styles";
import { PopoutTabSet } from "./tabset";

// Pop a tab out into its own browser window, and back. The core opens the window (`popoutURL`,
// served under the site's base path), copies the page's styles into it and moves the tab's
// content element there: the counter and the notes keep their state both ways. Closing the window
// docks its tabs back into the main layout (the default "dock" policy). A tab can also be dragged
// from the window into the main layout, and back (see the popout-drag example).

export type Types = { tabs: { card: undefined } };

const json: LayoutJson<Types> = {
    version: 1,
    // tabs may be popped out (off by default)
    defaults: { tab: { poppable: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", label: "Editor" },
                    { component: "card", label: "Preview" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "card", label: "Chat" },
                    {
                        component: "card",
                        label: "Pinned here",
                        // this one stays in the main window
                        poppable: false,
                    },
                ],
            },
        ],
    },
};

@Component({
    selector: "example-popout",
    imports: [DOCKABLE, Card, PopoutTabSet],
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
                            <example-popout-tabset [node]="node" />
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
                            <p [class]="styles.panelText">
                                Count, type a note, then pop the tab out with the button in its
                                header. Dock it back from the window, or close the window.
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
                                    <example-popout-tabset [node]="node" />
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
export default class Popout {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    // The popout host page, served next to the app under its base (Vite's `BASE_URL`).
    protected readonly popoutURL = `${import.meta.env.BASE_URL}popout.html`;
}
