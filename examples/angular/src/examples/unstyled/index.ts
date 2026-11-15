import { Component, input, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable-angular";
import * as styles from "./styles";

// The layout with no CSS: no primitive gets a class, and each renders a plain `div` with only
// structural inline styles (flex sizing, `position`, geometry, `display: none`). What you see is
// the browser's default rendering of that markup.

type Types = { tabs: { card: undefined } };

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
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [{ component: "card", label: "Inspector" }],
                    },
                    {
                        type: "tabset",
                        children: [{ component: "card", label: "Output" }],
                    },
                ],
            },
        ],
    },
};

/** Unstyled content too: a panel renders whatever you give it. */
@Component({
    selector: "example-unstyled-content",
    // the content's own element, out of the layout's way
    host: { style: "display: contents" },
    template: `
        <div>
            <h2>{{ tab().label }}</h2>
            <button type="button" (click)="count.set(count() + 1)">Count: {{ count() }}</button>
        </div>
    `,
})
class Content {
    readonly tab = input.required<TabOf<Types>>();
    protected readonly count = signal(0);
}

@Component({
    selector: "example-unstyled",
    imports: [DOCKABLE, Content],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <!-- The stage's theme sets an inherited font, colour and background: \`all: initial\` on
                 this wrapper cuts that inheritance, so the layout below shows what the browser
                 gives you with no CSS at all (black serif text on the canvas colour). It is the
                 example's own element, not a Dockable primitive; an app would not need it. -->
            <div
                data-testid="unstyled-frame"
                style="all: initial; display: flex; flex: 1; min-height: 0; background: Canvas; color: CanvasText"
            >
                <!-- The root is \`position: relative\`; it only needs a size to lay out in. -->
                <div [dockableRoot]="model" style="flex: 1">
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <div [dockableTabSet]="node">
                                    <div>
                                        <div dockableTabList aria-label="Tabs">
                                            <ng-template [dockableTabListItem]="model" let-tab>
                                                <div [dockableTab]="tab"><span>{{ tab.label }}</span></div>
                                            </ng-template>
                                        </div>
                                    </div>
                                    <div dockableTabSetContent></div>
                                </div>
                            }
                        </ng-template>
                        <!-- A splitter has no name of its own: the row inserts it, so this
                             template names it. -->
                        <ng-template dockableRowSplitter let-node="node" let-index="index">
                            <div [dockableSplitter]="node" [index]="index" aria-label="Resize"></div>
                        </ng-template>
                    </div>
                    <ng-template [dockablePanels]="model" let-tab>
                        <div [dockablePanel]="tab">
                            <example-unstyled-content [tab]="tab" />
                        </div>
                    </ng-template>
                </div>
            </div>
        </div>
    `,
})
export default class Unstyled {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
}
