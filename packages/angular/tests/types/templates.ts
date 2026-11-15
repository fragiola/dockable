// Type fixtures, checked by `ngc` (strict templates), never run: the template directives' contexts
// are typed by the registry of the model they are given. `@ts-expect-error` marks what must not
// compile.
import { Component, input } from "@angular/core";
import {
    DOCKABLE,
    DockablePanels,
    DockableRowChild,
    DockableTabListItem,
    type Model,
    type PanelsContext,
    type RowChildContext,
    type TabListItemContext,
    type TabOf,
} from "../../src/public-api";

type Types = {
    tabs: {
        editor: { path: string };
        chart: { series: number[] };
    };
};

declare const model: Model<Types>;
declare const context: unknown;

// the context guard narrows the template context to the registry of the given model
declare const panels: DockablePanels<Types>;
if (DockablePanels.ngTemplateContextGuard(panels, context)) {
    const typed: PanelsContext<Types> = context;
    const tab: TabOf<Types> = typed.$implicit;
    if (tab.component === "editor") {
        const path: string = tab.data.path;
        void path;
        // @ts-expect-error an editor tab has no series
        void tab.data.series;
    }
    // @ts-expect-error a tab of the registry has no other component
    void (tab.component === "other");
}

declare const rowChild: DockableRowChild<Types>;
if (DockableRowChild.ngTemplateContextGuard(rowChild, context)) {
    const typed: RowChildContext<Types> = context;
    if (typed.$implicit.type === "tabset") {
        const tabs: readonly TabOf<Types>[] = typed.$implicit.children;
        void tabs;
    }
    // @ts-expect-error a row child is a tabset or a row
    void (typed.node.type === "border");
}

declare const item: DockableTabListItem<Types>;
if (DockableTabListItem.ngTemplateContextGuard(item, context)) {
    const typed: TabListItemContext<Types> = context;
    const label: string = typed.tab.label;
    void label;
    // @ts-expect-error a tab's data is typed by its component
    const wrong: number = typed.tab.data;
    void wrong;
}

void model;

/** A template whose nodes are typed by the model it gives the template directives. */
@Component({
    selector: "fixture-typed",
    imports: [DOCKABLE],
    template: `
        <div [dockableRoot]="model()">
            <div dockableRow>
                <ng-template [dockableRowChild]="model()" let-node>
                    @if (node.type === "tabset") {
                        <div [dockableTabSet]="node">
                            <div dockableTabList>
                                <ng-template [dockableTabListItem]="model()" let-tab>
                                    <div [dockableTab]="tab">{{ tab.label }}</div>
                                </ng-template>
                            </div>
                            <div dockableTabSetContent></div>
                        </div>
                    }
                </ng-template>
            </div>
            <ng-template [dockablePanels]="model()" let-tab>
                <div [dockablePanel]="tab">
                    @if (tab.component === "editor") {
                        <input [value]="tab.data.path" />
                    } @else {
                        <span>{{ tab.data.series.length }}</span>
                    }
                </div>
            </ng-template>
        </div>
    `,
})
export class TypedFixture {
    readonly model = input.required<Model<Types>>();
}
