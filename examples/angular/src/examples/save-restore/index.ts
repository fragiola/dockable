import {
    ChangeDetectorRef,
    Component,
    effect,
    inject,
    signal,
} from "@angular/core";
import {
    type CommandError,
    createModel,
    DOCKABLE,
    injectDockable,
    injectModelState,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { LucideRotateCcw, LucideSave, LucideUpload } from "@lucide/angular";
import { PanelBody } from "../_kit/card";
import { TablePanel } from "../_kit/data";
import * as styles from "./styles";

// versioned: a layout saved with an older registry (its "card" tabs) is not restored
const STORAGE_KEY = "dockable-example:save-restore:v3";

type Types = {
    tabs: {
        json: undefined;
        doc: { text: string };
        table: undefined;
    };
};

// Explicit ids: a reset or a restore keeps every tab whose id survives, content and all.
const defaultJson: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "welcome",
                        component: "doc",
                        label: "Welcome",
                        data: {
                            text: "Move tabs or drag a splitter, then save. Reset brings back the default layout; Restore loads the saved one.",
                        },
                    },
                    {
                        id: "notes",
                        component: "doc",
                        label: "Notes",
                        data: {
                            text: "The tabs have explicit ids: a reset or a restore keeps every tab whose id survives, content and all.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    {
                        id: "json",
                        component: "json",
                        label: "Layout JSON",
                    },
                    {
                        id: "inspector",
                        component: "table",
                        label: "Inspector",
                    },
                ],
            },
        ],
    },
};

// Storage can throw (private mode, a full quota, storage disabled): never let it break the app.
// What comes back is untrusted text: `layout.load` validates it before anything changes.
function readSaved(): unknown {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        return text ? JSON.parse(text) : undefined;
    } catch {
        return undefined;
    }
}

function writeSaved(json: LayoutJson<Types>): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(json));
        return true;
    } catch {
        return false;
    }
}

/** Why a stored layout was refused: the message and the JSON path of each problem. */
function describeError(error: CommandError): string {
    const issues = error.issues ?? [];
    if (issues.length === 0) {
        return error.message;
    }
    return issues
        .map((issue) => `${issue.path || "/"} ${issue.message}`)
        .join("; ");
}

/** The model's JSON, live: this is everything there is to save. */
@Component({
    selector: "example-json-panel",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body title='model.get("layout-json")'>
            <pre data-testid="layout-json" [class]="styles.layoutJson">{{ text() }}</pre>
        </kit-panel-body>
    `,
})
class JsonPanel {
    protected readonly styles = styles;
    protected readonly text = injectModelState<Types, string>((_state, model) =>
        JSON.stringify(model.get("layout-json"), null, 2),
    );

    constructor() {
        // Angular renders a changed signal on its next frame; the JSON is what a reader copies to
        // save, so this view renders the moment the model changes (the selector reads it first)
        const view = inject(ChangeDetectorRef);
        const { model } = injectDockable<Types>();
        effect((onCleanup) => {
            onCleanup(model().subscribe(() => view.detectChanges()));
        });
    }
}

@Component({
    selector: "example-save-restore",
    imports: [
        DOCKABLE,
        LucideSave,
        LucideUpload,
        LucideRotateCcw,
        PanelBody,
        TablePanel,
        JsonPanel,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.page">
            <div [class]="styles.toolbar">
                <button type="button" [class]="styles.primaryButton" (click)="save()">
                    <svg lucideSave aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Save
                </button>
                <button type="button" [class]="styles.button" (click)="restore()">
                    <svg lucideUpload aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Restore
                </button>
                <button type="button" [class]="styles.button" (click)="reset()">
                    <svg lucideRotateCcw aria-hidden="true" [class]="styles.buttonIcon"></svg>
                    Reset
                </button>
                <output data-testid="status" [class]="styles.status">{{ status() }}</output>
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
                                    <example-json-panel />
                                }
                                @case ("doc") {
                                    <kit-panel-body [title]="tab.label">
                                        <p>{{ tab.data.text }}</p>
                                    </kit-panel-body>
                                }
                                @case ("table") {
                                    <kit-table-panel />
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
        </div>
    `,
})
export default class SaveRestore {
    protected readonly styles = styles;
    // one model for the example's lifetime: restoring or resetting loads a layout into it
    protected readonly model = createModel<Types>(defaultJson);
    protected readonly status = signal("Move tabs or resize, then save.");

    protected save() {
        this.status.set(
            writeSaved(this.model.get("layout-json"))
                ? "Saved to localStorage."
                : "Could not save: storage is unavailable.",
        );
    }

    protected restore() {
        const saved = readSaved();
        if (saved === undefined) {
            this.status.set("Nothing saved yet.");
            return;
        }
        // `dispatch` takes untrusted JSON: the stored layout is validated against JSON v1 (and
        // its ids checked) before it replaces the current one, in place
        const result = this.model.dispatch({
            command: "layout.load",
            payload: { layout: saved },
        });
        this.status.set(
            result.ok
                ? "Restored from localStorage."
                : `Could not restore: ${describeError(result.error)}`,
        );
    }

    protected reset() {
        this.model.run("layout.load", { layout: defaultJson });
        this.status.set("Reset to the default layout.");
    }
}
