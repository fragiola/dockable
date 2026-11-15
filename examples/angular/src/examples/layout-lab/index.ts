import { Component, DestroyRef, inject, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    veto as vetoResult,
} from "@fragiola/dockable-angular";
import { LucidePlus, LucideRedo2, LucideUndo2, LucideX } from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { CHART_KINDS, ChartPanel } from "../_kit/charts";
import { LogPanel } from "../_kit/data";
import { UndoManager } from "../_kit/undo";
import {
    appendToLog,
    initialLayout,
    type LogEntry,
    type Types,
} from "./commands";
import { CommandLog, JsonEditor, type Veto, VetoControl } from "./panels";
import * as styles from "./styles";

// The model is the source of truth, made visible. Left: the model's JSON (v1), editable (Apply
// loads it with the `layout.load` command, validated first). Right: the layout it renders. Below:
// every command a middleware (`model.use`) sees, and a switch that vetoes one command (the
// middleware returns `veto(…)`, the model does not change). Undo and redo load the previous layout
// back into the same model.

let added = 0;

@Component({
    selector: "example-layout-lab",
    imports: [
        DOCKABLE,
        LucidePlus,
        LucideRedo2,
        LucideUndo2,
        LucideX,
        PanelBody,
        ChartPanel,
        LogPanel,
        JsonEditor,
        VetoControl,
        CommandLog,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.lab">
            <example-json-editor [model]="model" [load]="load" />
            <div [class]="styles.main">
                <div [class]="styles.toolbar">
                    <div [class]="styles.history">
                        <button
                            type="button"
                            aria-label="Undo"
                            [disabled]="!history().canUndo"
                            [class]="styles.undoButton"
                            (click)="undo.undo()"
                        >
                            <svg lucideUndo2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        </button>
                        <button
                            type="button"
                            aria-label="Redo"
                            [disabled]="!history().canRedo"
                            [class]="styles.redoButton"
                            (click)="undo.redo()"
                        >
                            <svg lucideRedo2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        </button>
                    </div>
                    <button type="button" [class]="styles.button" (click)="addTab()">
                        <svg lucidePlus aria-hidden="true" [class]="styles.buttonIcon"></svg>
                        Add tab
                    </button>
                    <div [class]="styles.vetoSlot">
                        <example-veto-control
                            [veto]="veto()"
                            [commands]="commands"
                            (vetoChange)="veto.set($event)"
                        />
                    </div>
                </div>
                <div [class]="styles.frame">
                    <div [dockableRoot]="model" [class]="styles.root">
                        <!-- The JSON may give the layout borders: they are drawn around it. -->
                        <div dockableBorders>
                            <!-- A border's strip: its tabs, with labels turned along a side border. -->
                            <ng-template [dockableBordersBar]="model" let-border>
                                <div [dockableBorder]="border" [class]="styles.border">
                                    <div
                                        dockableTabList
                                        [attr.aria-label]="border.location + ' panels'"
                                        [class]="styles.borderTabList"
                                    >
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.borderTab">{{ tab.label }}</div>
                                        </ng-template>
                                    </div>
                                </div>
                            </ng-template>
                            <ng-template [dockableBordersContent]="model" let-border>
                                <div [dockableBorderContent]="border" [class]="styles.borderContent">
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
                                                            <!-- a close button: one more command to watch in the log;
                                                                 the tab is the tab stop: Ctrl+Delete on it closes it
                                                                 from the keyboard. The press must not activate the
                                                                 tabset, and a click on the tab would select it -->
                                                            <button
                                                                type="button"
                                                                tabindex="-1"
                                                                [attr.aria-label]="'Close ' + tab.label"
                                                                [class]="styles.tabClose"
                                                                (pointerdown)="$event.stopPropagation()"
                                                                (click)="$event.stopPropagation(); model.run('tab.close', { tabId: tab.id })"
                                                            >
                                                                <svg lucideX aria-hidden="true" [class]="styles.tabCloseIcon"></svg>
                                                            </button>
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
                        </div>
                        <ng-template [dockablePanels]="model" let-tab>
                            <div [dockablePanel]="tab" [class]="styles.panel">
                                @switch (tab.component) {
                                    @case ("chart") {
                                        <kit-chart-panel
                                            [kind]="tab.data.kind"
                                            [seed]="tab.label.length"
                                            [title]="tab.label"
                                        />
                                    }
                                    @case ("log") {
                                        <kit-log-panel />
                                    }
                                    @case ("card") {
                                        <kit-panel-body [title]="tab.label">
                                            <p [class]="styles.cardText">{{
                                                tab.data?.text ?? "A card: its label names it, its data holds its text."
                                            }}</p>
                                        </kit-panel-body>
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
                <example-command-log [log]="log()" (clear)="log.set([])" />
            </div>
        </div>
    `,
})
export default class LayoutLab {
    protected readonly styles = styles;
    // one model for the lab's lifetime: Apply, undo and redo load a layout into it
    protected readonly model = createModel<Types>(initialLayout);
    protected readonly undo = new UndoManager(this.model);
    protected readonly veto = signal<Veto>({
        enabled: false,
        command: "tab.select",
    });
    protected readonly commands = this.model.get("commands");
    protected readonly history = signal(this.undo.getSnapshot());
    protected readonly log = signal<LogEntry[]>([]);
    // untrusted JSON: `dispatch` validates it (JSON v1, ids) before the layout changes; a command
    // like any other, so it is logged, vetoable and undoable
    protected readonly load = (layout: unknown) =>
        this.model.dispatch({ command: "layout.load", payload: { layout } });

    constructor() {
        const destroyRef = inject(DestroyRef);
        destroyRef.onDestroy(
            this.undo.subscribe(() =>
                this.history.set(this.undo.getSnapshot()),
            ),
        );
        // Every command passes here first: it is logged, and applied unless it is the vetoed one.
        // The middleware is installed once and reads the current veto from its signal; the log is
        // a signal of its own, so a command re-renders the log, not the layout.
        destroyRef.onDestroy(
            this.model.use((ctx, next) => {
                const current = this.veto();
                const vetoed =
                    current.enabled && ctx.command === current.command;
                const result = vetoed
                    ? vetoResult(`${ctx.command} is vetoed in the lab`)
                    : next();
                // a dry run (`model.can`: a drag hovering a target, a button's enabled state)
                // commits nothing, and a batch is logged once, as the batch
                if (!ctx.dryRun && !ctx.inBatch) {
                    this.log.update((log) =>
                        appendToLog(
                            log,
                            ctx.command,
                            ctx.payload,
                            result.ok ? "applied" : result.error.code,
                            ctx.transient,
                        ),
                    );
                }
                return result;
            }),
        );
    }

    protected addTab() {
        const target = this.model.get("default-tabset");
        if (!target) return;
        added += 1;
        // a chart, of the next kind each time
        this.model.run("tab.add", {
            component: "chart",
            label: `Chart ${added}`,
            data: { kind: CHART_KINDS[added % CHART_KINDS.length] ?? "line" },
            to: target.id,
        });
    }
}
