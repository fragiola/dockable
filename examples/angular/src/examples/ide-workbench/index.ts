import {
    Component,
    computed,
    DestroyRef,
    inject,
    input,
    signal,
} from "@angular/core";
import {
    type BorderNode,
    DOCKABLE,
    injectModelState,
    type Model,
    type TabOf,
    veto,
} from "@fragiola/dockable-angular";
import {
    LucideBug,
    LucideDynamicIcon,
    LucideFolderTree,
    LucideGitBranch,
    type LucideIcon,
    LucideSquareTerminal,
} from "@lucide/angular";
import { ClickableButton } from "#/components/atoms/clickable";
import { ALERT_DIALOG } from "#/components/ui/alert-dialog";
import { TOOLTIP } from "#/components/ui/tooltip";
import { Explorer } from "./explorer";
import { EditorPanel, ProblemsPanel, TerminalPanel } from "./panels";
import * as styles from "./styles";
import { WorkbenchTabSet } from "./tabs";
import {
    activePath,
    createWorkspace,
    defaultLayout,
    dirtyPaths,
    editorData,
    forgetLayout,
    openFile,
    restoreModel,
    saveLayout,
    type Types,
} from "./workspace";

// A code-editor workbench. The explorer (a start border) and the terminal and problems (a bottom
// border) are borders around the editors; the explorer and the status bar change the layout with
// commands on the model (`model.run`); the tabs follow their content (a dot while modified);
// closing a modified tab is stopped by a middleware (`model.use`), whatever closed it (button,
// menu, Ctrl+Delete); and the layout is saved on every change (`model.subscribe`, `toJSON`) and
// restored on the next visit (`createModel`, which reports a stored layout that is not valid).

const BORDER_ICONS: Partial<Record<TabOf<Types>["component"], LucideIcon>> = {
    explorer: LucideFolderTree,
    terminal: LucideSquareTerminal,
    problems: LucideBug,
};

/** The status bar follows the model: a commit re-checks it, not the layout. */
@Component({
    selector: "example-ide-status-bar",
    imports: [LucideGitBranch],
    host: { class: "contents" },
    template: `
        <footer [class]="styles.statusBar">
            <span [class]="styles.statusBranch">
                <svg lucideGitBranch aria-hidden="true" [class]="styles.statusBranchIcon"></svg>
                main
            </span>
            <span data-testid="unsaved-count">{{
                unsaved() === 1 ? "1 unsaved file" : unsaved() + " unsaved files"
            }}</span>
            <span [class]="styles.statusPath">{{ path() ?? "" }}</span>
        </footer>
    `,
})
export class StatusBar {
    readonly model = input.required<Model<Types>>();
    protected readonly styles = styles;
    protected readonly unsaved = injectModelState(
        (_state, model) => dirtyPaths(model).size,
        { model: this.model },
    );
    protected readonly path = injectModelState(
        (_state, model) => activePath(model),
        { model: this.model },
    );
}

@Component({
    selector: "example-ide-workbench",
    imports: [
        DOCKABLE,
        ALERT_DIALOG,
        TOOLTIP,
        ClickableButton,
        LucideDynamicIcon,
        Explorer,
        EditorPanel,
        TerminalPanel,
        ProblemsPanel,
        WorkbenchTabSet,
        StatusBar,
    ],
    host: { class: "contents" },
    template: `
        <div [class]="styles.workbench">
            @if (problem(); as problem) {
                <div role="alert" data-testid="restore-problem" [class]="styles.restoreProblem">
                    <div [class]="styles.restoreProblemBody">
                        <p>
                            The saved layout could not be restored, so the default one is shown:
                            {{ problem.message }}
                        </p>
                        @if (problem.issues.length > 0) {
                            <ul [class]="styles.restoreProblemIssues">
                                @for (issue of problem.issues; track issue.path + " " + issue.message) {
                                    <li>{{ (issue.path || "/") + ": " + issue.message }}</li>
                                }
                            </ul>
                        }
                    </div>
                    <button
                        type="button"
                        [class]="styles.restoreProblemDismiss"
                        (click)="problem$.set(undefined)"
                    >
                        Dismiss
                    </button>
                </div>
            }
            <!-- hairline splitters with a wider grab area, whatever the theme -->
            <div [class]="styles.stage">
                <div [class]="styles.frame">
                    <div [dockableRoot]="model" [class]="styles.root">
                        <div dockableBorders>
                            <!-- A border's strip. The start border is an activity bar, as in VS
                                 Code: an upright icon per tab, named by aria-label and a tooltip, in
                                 a bar as wide as its icon buttons. The bottom border's tabs keep
                                 their icon and name. -->
                            <ng-template [dockableBordersBar]="model" let-border>
                                <div [dockableBorder]="border" [class]="styles.border">
                                    <div
                                        dockableTabList
                                        [attr.aria-label]="border.location + ' panels'"
                                        [class]="styles.borderTabList"
                                    >
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <!-- an icon-only tab is named by its tab's name; upright
                                                 and centred in a side bar -->
                                            <div
                                                [dockableTab]="tab"
                                                [attr.aria-label]="isSide(border) ? tab.label : null"
                                                [class]="styles.borderTab(isSide(border))"
                                            >
                                                @if (isSide(border)) {
                                                    <span
                                                        [kitTooltipTrigger]="tip"
                                                        [class]="styles.borderTabTooltip"
                                                    >
                                                        @if (iconOf(tab); as icon) {
                                                            <svg
                                                                [lucideIcon]="icon"
                                                                aria-hidden="true"
                                                                [class]="styles.borderTabIcon"
                                                            ></svg>
                                                        }
                                                    </span>
                                                    <ng-template #tip>
                                                        <div kitTooltipContent>{{ tab.label }}</div>
                                                    </ng-template>
                                                } @else {
                                                    @if (iconOf(tab); as icon) {
                                                        <svg
                                                            [lucideIcon]="icon"
                                                            aria-hidden="true"
                                                            [class]="styles.borderTabIcon"
                                                        ></svg>
                                                    }
                                                    {{ tab.label }}
                                                }
                                            </div>
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
                                        <example-ide-tabset [node]="node" />
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
                                    @case ("editor") {
                                        <example-ide-editor [tab]="tab" [workspace]="workspace" />
                                    }
                                    @case ("terminal") {
                                        <example-ide-terminal [workspace]="workspace" />
                                    }
                                    @case ("problems") {
                                        <example-ide-problems (openFile)="open($event)" />
                                    }
                                    @case ("explorer") {
                                        <example-ide-explorer
                                            [model]="model"
                                            (openFile)="open($event)"
                                            (resetLayout)="resetLayout()"
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
            </div>

            <example-ide-status-bar [model]="model" />

            <ng-template
                [kitAlertDialog]="pendingData() !== undefined"
                (openChange)="!$event && answer('cancel')"
            >
                <div kitAlertDialogBackdrop></div>
                <div kitAlertDialogContent>
                    <div kitAlertDialogHeader>
                        <h2 kitAlertDialogTitle>{{ "Save changes to " + pendingLabel() + "?" }}</h2>
                        <p kitAlertDialogDescription>
                            Your changes will be lost if you close the file without saving.
                        </p>
                    </div>
                    <div kitAlertDialogFooter>
                        <button kitClickable variant="ghost" size="sm" (click)="answer('discard')">
                            Don't save
                        </button>
                        <button kitClickable variant="outline" size="sm" (click)="answer('cancel')">
                            Cancel
                        </button>
                        <button kitClickable size="sm" [class]="styles.saveButton" (click)="answer('save')">
                            Save
                        </button>
                    </div>
                </div>
            </ng-template>
        </div>
    `,
})
export default class IdeWorkbench {
    protected readonly styles = styles;
    protected readonly workspace = createWorkspace();
    // the model, restored from storage; `problem` says why a stored layout was not used
    private readonly restored = restoreModel();
    protected readonly model = this.restored.model;
    protected readonly problem$ = signal(this.restored.problem);
    protected readonly problem = this.problem$.asReadonly();
    // tabs waiting for an answer to "save changes?", and the ones already answered
    private readonly pending = signal<string[]>([]);
    private readonly confirmed = new Set<string>();

    // the first pending question
    private readonly pendingNode = computed(() => {
        const id = this.pending()[0];
        return id ? this.model.get("node-by", { id }) : undefined;
    });
    protected readonly pendingData = computed(() =>
        editorData(this.pendingNode()),
    );
    protected readonly pendingLabel = computed(() => {
        const node = this.pendingNode();
        return node?.type === "tab" ? node.label : "";
    });

    constructor() {
        const destroyRef = inject(DestroyRef);
        // The policy: closing a modified editor asks first. The middleware sees every `tab.close`,
        // from any button, menu or key; it vetoes the close and queues the question, and the dialog
        // runs the close again once answered. A dry run (`model.can`, which decides whether the
        // close button and shortcut are offered) passes: the tab may close, after the question.
        destroyRef.onDestroy(
            this.model.use((ctx, next) => {
                if (ctx.command !== "tab.close" || ctx.dryRun) {
                    return next();
                }
                const id = ctx.payload.tabId;
                if (!editorData(ctx.get("node-by", { id }))?.dirty) {
                    return next();
                }
                if (this.confirmed.delete(id)) {
                    return next();
                }
                this.pending.update((ids) =>
                    ids.includes(id) ? ids : [...ids, id],
                );
                return veto("the file has unsaved changes");
            }),
        );
        // every change is saved (a drag's transient steps once, at its end)
        destroyRef.onDestroy(
            this.model.subscribe((event) => {
                if (!event.transient) saveLayout(this.model);
            }),
        );
    }

    protected isSide(border: BorderNode<Types>) {
        return border.location === "start" || border.location === "end";
    }

    protected iconOf(tab: TabOf<Types>) {
        return BORDER_ICONS[tab.component];
    }

    protected open(path: string) {
        openFile(this.model, path);
    }

    // the same model loads the default layout: open editors keep their content
    protected resetLayout() {
        forgetLayout();
        this.problem$.set(undefined);
        this.model.run("layout.load", { layout: defaultLayout });
    }

    protected answer(choice: "save" | "discard" | "cancel") {
        const id = this.pending()[0];
        const data = this.pendingData();
        this.pending.update((ids) => ids.slice(1));
        if (!id || !data || choice === "cancel") return;
        if (choice === "save") this.workspace.save(data.path);
        else this.workspace.discard(data.path);
        this.confirmed.add(id);
        this.model.run("tab.close", { tabId: id });
    }
}
