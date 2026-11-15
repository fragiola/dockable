import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    type TabOf,
} from "@fragiola/dockable-angular";
import {
    LucideDynamicIcon,
    LucideFileCode2,
    type LucideIcon,
    LucideListTree,
    LucideSearch,
    LucideSquareTerminal,
} from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { LogPanel } from "../_kit/data";
import * as styles from "./styles";

// Borders are part of the model (`borders` in its JSON): a strip of tabs on one side of the
// layout, whose selected tab opens a panel beside it. `[dockableBorders]` (the frame) places them
// around the main layout, `[dockableBorder]` (the strip) holds a border's tabs and
// `[dockableBorderContent]` (the panel area and its splitter) is where its panel opens; open one,
// resize it, or drag a tab between a border and the tabsets.

// The tab's name is its label; only the editor has data of its own.
type Types = {
    tabs: {
        explorer: undefined;
        search: undefined;
        terminal: undefined;
        outline: undefined;
        editor: { source: string };
    };
};

// What the two editor tabs show.
const APP_SOURCE = `import { createStore } from "./store";

export function createApp(root: HTMLElement) {
    const store = createStore({ theme: "light" });
    render(root, store.state);
    return { store, mount: () => render(root, store.state) };
}`;

const STORE_SOURCE = `export function createStore<S>(initial: S) {
    let state = initial;
    const listeners = new Set<(state: S) => void>();
    return {
        get state() { return state; },
        set(next: S) {
            state = next;
            for (const listener of listeners) listener(state);
        },
        subscribe: (listener: (state: S) => void) => listeners.add(listener),
    };
}`;

const json: LayoutJson<Types> = {
    version: 1,
    // every border's panel size, unless the border sets its own
    defaults: { border: { size: 220 } },
    borders: [
        {
            location: "start",
            selected: 0,
            children: [
                { component: "explorer", label: "Explorer" },
                { component: "search", label: "Search" },
            ],
        },
        {
            location: "bottom",
            size: 160,
            children: [
                { component: "terminal", label: "Terminal" },
                { component: "terminal", label: "Output" },
            ],
        },
        {
            location: "end",
            children: [{ component: "outline", label: "Outline" }],
        },
    ],
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        component: "editor",
                        label: "app.ts",
                        data: { source: APP_SOURCE },
                    },
                    {
                        component: "editor",
                        label: "store.ts",
                        data: { source: STORE_SOURCE },
                    },
                ],
            },
        ],
    },
};

const FILES = ["src/app.ts", "src/store.ts", "src/theme.css", "README.md"];

// an icon per border component (the editors have none)
const icons: Partial<Record<TabOf<Types>["component"], LucideIcon>> = {
    explorer: LucideListTree,
    search: LucideSearch,
    terminal: LucideSquareTerminal,
    outline: LucideFileCode2,
};

@Component({
    selector: "example-borders",
    imports: [DOCKABLE, LucideDynamicIcon, PanelBody, LogPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <!-- The model's borders around the main layout: each one's strip, and the area
                     where its selected tab's panel opens. -->
                <div dockableBorders>
                    <!-- A border's strip, with its tabs: a column on a side border. -->
                    <ng-template [dockableBordersBar]="model" let-border>
                        <div [dockableBorder]="border" [class]="styles.border">
                            <div
                                dockableTabList
                                [attr.aria-label]="border.location + ' panels'"
                                [class]="styles.borderTabList"
                            >
                                <ng-template [dockableTabListItem]="model" let-tab>
                                    <div [dockableTab]="tab" [class]="styles.borderTab">
                                        @if (icons[tab.component]; as icon) {
                                            <svg [lucideIcon]="icon" aria-hidden="true" [class]="styles.borderTabIcon"></svg>
                                        }
                                        {{ tab.label }}
                                    </div>
                                </ng-template>
                            </div>
                        </div>
                    </ng-template>
                    <!-- Where a border's panel opens, with a splitter on the layout's side of it to
                         resize it. -->
                    <ng-template [dockableBordersContent]="model" let-border>
                        <div [dockableBorderContent]="border">
                            <ng-template dockableBorderSplitter let-node>
                                <div [dockableSplitter]="node" aria-label="Resize" [class]="styles.splitter">
                                    <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                                </div>
                            </ng-template>
                        </div>
                    </ng-template>
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
                        <!-- The bar between two children of a row, with a grip for the themes
                             that show one. -->
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
                </div>
                <!-- Every tab's content, the borders' too, positioned by the engine. -->
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("explorer") {
                                <kit-panel-body title="Explorer">
                                    <ul [class]="styles.files">
                                        @for (file of FILES; track file) {
                                            <li [class]="styles.file">{{ file }}</li>
                                        }
                                    </ul>
                                </kit-panel-body>
                            }
                            @case ("search") {
                                <kit-panel-body title="Search">
                                    <input aria-label="Search files" placeholder="Search" [class]="styles.searchInput" />
                                </kit-panel-body>
                            }
                            @case ("terminal") {
                                <kit-log-panel />
                            }
                            @case ("outline") {
                                <kit-panel-body title="Outline">
                                    <p [class]="styles.outline">createApp · render · mount</p>
                                </kit-panel-body>
                            }
                            @case ("editor") {
                                <pre [class]="styles.source">{{ tab.data.source }}</pre>
                            }
                        }
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
export default class Borders {
    protected readonly styles = styles;
    protected readonly FILES = FILES;
    protected readonly icons = icons;
    protected readonly model = createModel<Types>(json);
}
