import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { LucideDynamicIcon } from "@lucide/angular";
import * as styles from "./styles";
import {
    iconOf,
    type Types,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetTab,
} from "./widgets";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [{ component: "revenue", label: "Revenue chart" }],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "orders", label: "Orders table" }],
            },
        ],
    },
};

@Component({
    selector: "example-widget-sidebar",
    imports: [DOCKABLE, LucideDynamicIcon, WidgetContent],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <aside aria-label="Widgets" [class]="styles.sidebar">
                <h2 [class]="styles.sidebarTitle">Widgets</h2>
                <ul [class]="styles.widgetList">
                    @for (source of sources; track source.widget.component) {
                        @let widget = source.widget;
                        <li>
                            <!-- A widget in the sidebar: drag it into the layout, or click it
                                 (keyboard: Enter) to add it. -->
                            <button
                                type="button"
                                [dockableDragSource]="model"
                                [tab]="source.tab"
                                (dropped)="onAdded($event.tabId)"
                                (click)="addToActiveTabset(widget)"
                                aria-description="Drag into the layout, or press to add to the active tabset"
                                [class]="styles.widget"
                            >
                                <span [class]="styles.widgetIconBox">
                                    <svg [lucideIcon]="widget.icon" aria-hidden="true" [class]="styles.widgetIcon"></svg>
                                </span>
                                <span [class]="styles.widgetText">
                                    <span [class]="styles.widgetTitle">{{ widget.title }}</span>
                                    <span [class]="styles.widgetDescription">{{ widget.description }}</span>
                                </span>
                            </button>
                        </li>
                    }
                </ul>
                <p role="status" data-testid="status" [class]="styles.status">{{ status() }}</p>
            </aside>
            <div [class]="styles.frame">
                <div [dockableRoot]="model" [class]="styles.root">
                    <div dockableRow>
                        <ng-template [dockableRowChild]="model" let-node>
                            @if (node.type === "row") {
                                <div [dockableRow]="node"></div>
                            } @else {
                                <!-- A tabset: a card with the strip of tabs (each with its widget's
                                     icon) on top. -->
                                <div [dockableTabSet]="node" [class]="styles.tabset">
                                    <div [class]="styles.strip">
                                        <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                                            <ng-template [dockableTabListItem]="model" let-tab>
                                                <div [dockableTab]="tab" [class]="styles.tab">
                                                    @if (iconOf(tab); as icon) {
                                                        <svg [lucideIcon]="icon" aria-hidden="true" [class]="styles.tabIcon"></svg>
                                                    }
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
                            <example-widget-content [tab]="tab" />
                        </div>
                    </ng-template>
                    <div
                        dockableDropIndicator
                        #indicator="dockableDropIndicator"
                        [class]="styles.dropIndicator(indicator.state())"
                    ></div>
                </div>
            </div>
        </div>
    `,
})
export default class WidgetSidebar {
    protected readonly styles = styles;
    protected readonly iconOf = iconOf;
    protected readonly model = createModel<Types>(json);
    protected readonly status = signal("");

    /** Each widget, with the tab a drag of it creates (made when the drag starts). */
    protected readonly sources = WIDGETS.map((widget) => ({
        widget,
        tab: () => widgetTab(widget),
    }));

    // the new tab's id, or undefined when the add was refused
    protected onAdded(id: string | undefined) {
        const tab =
            id === undefined ? undefined : this.model.get("node-by", { id });
        this.status.set(
            tab?.type === "tab" ? `Added ${tab.label}` : "Nothing added",
        );
    }

    // Native drag and drop has no keyboard path, so a click adds the widget to the active
    // tabset. `tab.add` runs on the model, through its middleware, like the drop does.
    protected addToActiveTabset(widget: Widget) {
        const target = this.model.get("default-tabset");
        if (!target) return;
        const added = this.model.run("tab.add", {
            ...widgetTab(widget),
            to: target.id,
            select: true,
        });
        this.onAdded(added.ok ? added.value.tabId : undefined);
    }
}
