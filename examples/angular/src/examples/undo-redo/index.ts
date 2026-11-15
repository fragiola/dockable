import {
    ChangeDetectorRef,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    signal,
} from "@angular/core";
import {
    type CommandName,
    createModel,
    DOCKABLE,
    injectDockable,
    injectModelState,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { LucidePlus, LucideRedo2, LucideUndo2, LucideX } from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { CHART_KINDS, type ChartKind, ChartPanel } from "../_kit/charts";
import { handleUndoKeys, UndoManager } from "../_kit/undo";
import * as styles from "./styles";

// Undo and redo with the examples' UndoManager (`_kit/undo.ts`: the package ships no undo). It
// listens to the model's commits (`model.subscribe`) and keeps the layout as it was before each
// step; undo and redo load it back into the same model (`layout.load`), so mounted content is
// kept. A splitter drag, many transient `row.resize` commands, is a single step.

type Types = {
    tabs: {
        json: undefined;
        doc: { text: string };
        chart: { kind: ChartKind; seed: number };
    };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "json", label: "Layout JSON" },
                    {
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move a tab, drag a splitter, add or close tabs: each edit is a step in the history above.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "Selecting a tab or a tabset is navigation, not an edit: it adds no step.",
                        },
                    },
                    {
                        component: "chart",
                        label: "Tasks",
                        data: { kind: "bar", seed: 4 },
                    },
                ],
            },
        ],
    },
};

// selecting a tab or a tabset is navigation, not an edit: it makes no undo step
const IGNORED: readonly CommandName[] = ["tabset.activate", "tab.select"];

/** A short name for a command, for the history list. */
function describe(command: CommandName): string {
    switch (command) {
        case "tab.add":
            return "Add tab";
        case "tab.close":
            return "Close tab";
        case "tab.move":
        case "tabset.move":
            return "Move";
        case "row.resize":
            return "Resize";
        case "tabset.maximize":
            return "Maximize";
        case "tab.rename":
            return "Rename";
        default:
            return command;
    }
}

/** Numbers the tabs the add button creates. */
let added = 0;

/** Add a tab to this tabset, and close its selected tab: two undoable edits. */
@Component({
    selector: "example-tabset-buttons",
    imports: [LucidePlus, LucideX],
    host: { class: "contents" },
    template: `
        <button type="button" aria-label="Add tab" [class]="styles.iconButton" (click)="add()">
            <svg lucidePlus aria-hidden="true" [class]="styles.iconButtonIcon"></svg>
        </button>
        <button
            type="button"
            aria-label="Close selected tab"
            [disabled]="!state().closeable"
            [class]="styles.iconButton"
            (click)="close()"
        >
            <svg lucideX aria-hidden="true" [class]="styles.iconButtonIcon"></svg>
        </button>
    `,
})
class TabsetButtons {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly model = injectDockable<Types>().model;
    // read again on every change of the model: the buttons sit outside the parts that re-render
    protected readonly state = injectModelState<
        Types,
        { selectedId: string | undefined; closeable: boolean }
    >(
        (_state, model) => {
            const selected = model.get("selected-tab-by", {
                tabsetId: this.tabset().id,
            });
            return {
                selectedId: selected?.id,
                closeable:
                    selected !== undefined &&
                    model.can("tab.close", { tabId: selected.id }),
            };
        },
        {
            isEqual: (a, b) =>
                a.selectedId === b.selectedId && a.closeable === b.closeable,
        },
    );

    protected add() {
        added += 1;
        // a new chart, of the next kind in turn
        this.model().run("tab.add", {
            component: "chart",
            label: `Tab ${added}`,
            data: {
                kind: CHART_KINDS[added % CHART_KINDS.length] ?? "line",
                seed: added * 3,
            },
            to: this.tabset().id,
        });
    }

    protected close() {
        const selectedId = this.state().selectedId;
        if (selectedId) this.model().run("tab.close", { tabId: selectedId });
    }
}

/** The layout's JSON, live: undo brings back exactly the previous text. */
@Component({
    selector: "example-layout-json-panel",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body title="Layout JSON">
            <pre data-testid="layout-json" [class]="styles.layoutJson">{{ text() }}</pre>
        </kit-panel-body>
    `,
})
class LayoutJsonPanel {
    protected readonly styles = styles;
    protected readonly text = injectModelState<Types, string>((_state, model) =>
        JSON.stringify(model.get("layout-json"), null, 2),
    );

    constructor() {
        // Angular renders a changed signal on its next frame; the JSON is what undo brings back,
        // so this view renders the moment the model changes (the selector reads it first)
        const view = inject(ChangeDetectorRef);
        const { model } = injectDockable<Types>();
        effect((onCleanup) => {
            onCleanup(model().subscribe(() => view.detectChanges()));
        });
    }
}

@Component({
    selector: "example-undo-redo",
    imports: [
        DOCKABLE,
        LucideUndo2,
        LucideRedo2,
        PanelBody,
        ChartPanel,
        TabsetButtons,
        LayoutJsonPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            <button
                type="button"
                [class]="styles.button"
                [disabled]="!snapshot().canUndo"
                aria-keyshortcuts="Control+Z Meta+Z"
                (click)="undo.undo()"
            >
                <svg lucideUndo2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                Undo
            </button>
            <button
                type="button"
                [class]="styles.button"
                [disabled]="!snapshot().canRedo"
                aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
                (click)="undo.redo()"
            >
                <svg lucideRedo2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                Redo
            </button>
            <ol aria-label="History" [class]="styles.history">
                @if (steps().length === 0) {
                    <li [class]="styles.historyHint">
                        Move, resize, add or close tabs: each edit is a step.
                    </li>
                }
                @for (step of steps(); track $index) {
                    <li [attr.data-undone]="step.undone ? '' : null" [class]="styles.historyStep">{{ step.name }}</li>
                }
            </ol>
        </div>
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset: the strip of tabs and its buttons on top, the measured
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
                                    <div [class]="styles.tabsetButtons">
                                        <example-tabset-buttons [tabset]="node" />
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
                        @switch (tab.component) {
                            @case ("json") {
                                <example-layout-json-panel />
                            }
                            @case ("doc") {
                                <kit-panel-body [title]="tab.label">
                                    <p>{{ tab.data.text }}</p>
                                </kit-panel-body>
                            }
                            @case ("chart") {
                                <kit-chart-panel
                                    [kind]="tab.data.kind"
                                    [seed]="tab.data.seed"
                                    [title]="tab.label"
                                />
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
export default class UndoRedo {
    protected readonly styles = styles;
    // one model and one manager for the example's lifetime: undo and redo load a layout into the
    // same model, so nothing is swapped
    protected readonly model = createModel<Types>(json);
    protected readonly undo = new UndoManager(this.model, {
        ignoreCommands: IGNORED,
    });
    protected readonly snapshot = signal(this.undo.getSnapshot());
    protected readonly steps = computed(() => {
        const { undoSteps, redoSteps } = this.snapshot();
        return [
            ...undoSteps.map((step) => ({
                name: describe(step.command),
                undone: false,
            })),
            // undone steps, oldest first, after the done ones
            ...[...redoSteps].reverse().map((step) => ({
                name: describe(step.command),
                undone: true,
            })),
        ];
    });

    constructor() {
        const unsubscribe = this.undo.subscribe(() =>
            this.snapshot.set(this.undo.getSnapshot()),
        );
        // Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redoes
        const onKeyDown = (event: KeyboardEvent) =>
            handleUndoKeys(this.undo, event);
        document.addEventListener("keydown", onKeyDown);
        inject(DestroyRef).onDestroy(() => {
            unsubscribe();
            document.removeEventListener("keydown", onKeyDown);
        });
    }
}
