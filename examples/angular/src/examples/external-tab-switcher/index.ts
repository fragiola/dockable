import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    injectModelState,
    type LayoutJson,
    type Model,
    type TabOf,
} from "@fragiola/dockable-angular";
import { LucideMinus, LucidePlus, LucideRotateCcw } from "@lucide/angular";
import * as styles from "./styles";

// Controls outside the layout drive what is inside it. The switcher above the layout selects a
// tab (`tab.select`) and follows the selection made by clicking a tab; the stepper changes the
// counter of the tab the user is looking at (`tab.set-data`). Both go through the model only.
//
// The count lives in the tab's typed data, not in the component's state: that is what lets code
// outside the layout read and change it, and it moves with the tab and saves with the layout.

type Types = { tabs: { counter: { count: number } } };

type CounterTab = TabOf<Types>;

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        id: "alpha",
                        component: "counter",
                        label: "Alpha",
                        data: { count: 0 },
                    },
                    {
                        id: "beta",
                        component: "counter",
                        label: "Beta",
                        data: { count: 0 },
                    },
                    {
                        id: "gamma",
                        component: "counter",
                        label: "Gamma",
                        data: { count: 0 },
                    },
                ],
            },
        ],
    },
};

/** Writes a counter tab's new count: `tab.set-data` patches it into the tab's data. */
function setCount(model: Model<Types>, tab: CounterTab, count: number) {
    model.run("tab.set-data", { tabId: tab.id, data: { count } });
}

@Component({
    selector: "example-external-tab-switcher",
    imports: [DOCKABLE, LucideMinus, LucidePlus, LucideRotateCcw],
    host: { class: "contents" },
    template: `
        <!-- The controls outside the layout: they read the model through selectors, so a commit
             re-renders them, not the layout. -->
        <div [class]="styles.controls">
            <fieldset aria-label="Show tab" [class]="styles.switcher">
                @for (tab of tabs(); track tab.id) {
                    <button
                        type="button"
                        [attr.aria-pressed]="tab.id === current()?.id"
                        [class]="styles.switchButton"
                        (click)="model.run('tab.select', { tabId: tab.id })"
                    >
                        {{ tab.label }}<span [class]="styles.switchCount">{{ tab.data.count }}</span>
                    </button>
                }
            </fieldset>
            <fieldset aria-label="Selected counter" [class]="styles.stepper">
                <button
                    type="button"
                    aria-label="Decrement"
                    [disabled]="!current()"
                    [class]="styles.stepButton"
                    (click)="step(-1)"
                >
                    <svg lucideMinus aria-hidden="true" [class]="styles.icon"></svg>
                </button>
                <output data-testid="outside-count" [class]="styles.stepValue">{{
                    current() ? current()!.label + ": " + current()!.data.count : "No tab"
                }}</output>
                <button
                    type="button"
                    aria-label="Increment"
                    [disabled]="!current()"
                    [class]="styles.stepButton"
                    (click)="step(1)"
                >
                    <svg lucidePlus aria-hidden="true" [class]="styles.icon"></svg>
                </button>
                <button
                    type="button"
                    aria-label="Reset"
                    [disabled]="!current()"
                    [class]="styles.stepButton"
                    (click)="reset()"
                >
                    <svg lucideRotateCcw aria-hidden="true" [class]="styles.icon"></svg>
                </button>
            </fieldset>
        </div>
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <div dockableTabList aria-label="Counters" [class]="styles.tabList">
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                                <span [class]="styles.tabCount">{{ tab.data.count }}</span>
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
                        ></div>
                    </ng-template>
                </div>
                <!-- A tab's content: its count, read from the tab's data, with its own button to
                     add one. -->
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        <div [class]="styles.counter">
                            <h2 [class]="styles.counterName">{{ tab.label }}</h2>
                            <p data-testid="count" [class]="styles.counterValue">{{ tab.data.count }}</p>
                            <button
                                type="button"
                                [class]="styles.counterButton"
                                (click)="add(tab)"
                            >
                                Add one
                            </button>
                        </div>
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
export default class ExternalTabSwitcher {
    protected readonly styles = styles;
    protected readonly model = createModel<Types>(json);
    protected readonly tabs = injectModelState(() => this.model.get("tabs"), {
        model: this.model,
    });
    // the tab the user is looking at: the selected tab of the active tabset (else the first)
    protected readonly current = injectModelState(
        () => {
            const tabset = this.model.get("default-tabset");
            return tabset
                ? this.model.get("selected-tab-by", { tabsetId: tabset.id })
                : undefined;
        },
        { model: this.model },
    );

    protected step(by: number) {
        const current = this.current();
        if (current) setCount(this.model, current, current.data.count + by);
    }

    protected reset() {
        const current = this.current();
        if (current) setCount(this.model, current, 0);
    }

    protected add(tab: CounterTab) {
        setCount(this.model, tab, tab.data.count + 1);
    }
}
