import { Component, effect, input, signal } from "@angular/core";
import {
    type CommandResult,
    createModel,
    DOCKABLE,
    type LayoutJson,
    type Middleware,
    veto,
} from "@fragiola/dockable-angular";
import { SWITCH } from "#/components/ui/switch";
import { type ChartKind, ChartPanel, KpiPanel } from "../_kit/charts";
import * as styles from "./styles";

// Middleware is how an app adds its own rules to the layout. Each one wraps every command, whoever
// issues it (a drag, a button, your code), and can do one of three things:
//
//   veto     a tabset holds at most four tabs: a fifth is refused, by a drag as well as from code,
//            and so is merging a tabset into one that would then hold more
//   rewrite  a tab's name is tidied before it commits (trimmed, capitalised, at most 20 letters)
//   observe  every command that commits is logged with its outcome, in the Log tab
//
// `model.use(middleware)` adds one and returns the function that removes it: each switch adds or
// removes its middleware at runtime. During a drag the engine asks `model.can` on every hover; the
// veto runs then too (`ctx.dryRun`), so the drop is refused before the tab is let go.

type Types = {
    tabs: {
        chart: { kind: ChartKind };
        kpi: { seed: number };
        log: undefined;
    };
};

const LIMIT = 4;

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "charts",
                weight: 40,
                children: [
                    {
                        component: "chart",
                        label: "Revenue",
                        data: { kind: "bar" },
                    },
                    {
                        component: "chart",
                        label: "Traffic",
                        data: { kind: "line" },
                    },
                    {
                        component: "chart",
                        label: "Share",
                        data: { kind: "pie" },
                    },
                ],
            },
            {
                type: "tabset",
                id: "kpis",
                weight: 30,
                children: [
                    { component: "kpi", label: "Orders", data: { seed: 4 } },
                    { component: "kpi", label: "Visitors", data: { seed: 8 } },
                ],
            },
            {
                type: "tabset",
                id: "log",
                weight: 30,
                children: [{ component: "log", label: "Log" }],
            },
        ],
    },
};

// ─── the three middlewares ──────────────────────────────────────────────────

/** Veto: no tabset may hold more than LIMIT tabs, however tabs join it. */
const limitTabs: Middleware<Types> = (ctx, next) => {
    if (
        ctx.command !== "tab.add" &&
        ctx.command !== "tab.move" &&
        ctx.command !== "tabset.move"
    ) {
        return next();
    }
    // a drop on a tabset's edge makes a new tabset: only "center" joins one
    if ((ctx.payload.location ?? "center") !== "center") return next();
    const target = ctx.get("node-by", { id: ctx.payload.to });
    if (target?.type !== "tabset") return next();
    // how many tabs would join it: a new tab, a tab from elsewhere (a reorder adds none), or
    // every tab of a tabset merged into it
    let joining = 1;
    if (ctx.command === "tab.move") {
        const tabId = ctx.payload.tabId;
        if (target.children.some((tab) => tab.id === tabId)) joining = 0;
    } else if (ctx.command === "tabset.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabsetId });
        joining =
            moved?.type === "tabset" && moved.id !== target.id
                ? moved.children.length
                : 0;
    }
    if (target.children.length + joining > LIMIT) {
        return veto(`A tabset holds at most ${LIMIT} tabs.`);
    }
    return next();
};

/** "  quarterly   revenue report " → "Quarterly revenue re…" */
function tidy(name: string) {
    const words = name.trim().replace(/\s+/g, " ");
    const capital = words.charAt(0).toUpperCase() + words.slice(1);
    return capital.length > 20 ? `${capital.slice(0, 19)}…` : capital;
}

/** Rewrite: a tab's new label is tidied, then the command runs with the new payload. */
const tidyNames: Middleware<Types> = (ctx, next) => {
    // `ctx.command` narrows the payload: a rename is `tab.rename`, with its label
    if (ctx.command === "tab.rename") {
        ctx.payload = { ...ctx.payload, label: tidy(ctx.payload.label) };
    }
    return next();
};

export interface LogEntry {
    id: number;
    command: string;
    outcome: string;
    ok: boolean;
}

/** Observe: runs the command, then reports what happened (never during a dry run). */
function logCommands(write: (entry: Omit<LogEntry, "id">) => void) {
    const middleware: Middleware<Types> = (ctx, next) => {
        const result = next();
        if (!ctx.dryRun) {
            write({
                command: ctx.command,
                outcome: result.ok ? "applied" : result.error.message,
                ok: result.ok,
            });
        }
        return result;
    };
    return middleware;
}

const RULES = [
    { key: "limit", label: `At most ${LIMIT} tabs per tabset` },
    { key: "tidy", label: "Tidy tab names" },
    { key: "log", label: "Log every command" },
] as const;

type RuleKey = (typeof RULES)[number]["key"];

/** What the observing middleware wrote, newest first. */
@Component({
    selector: "example-log",
    host: { class: "contents" },
    template: `
        @if (entries().length === 0) {
            <p [class]="styles.logEmpty">Commands appear here.</p>
        } @else {
            <ol aria-label="Command log" [class]="styles.log">
                @for (entry of entries(); track entry.id) {
                    <li [class]="styles.logEntry">
                        <span [class]="styles.logCommand">{{ entry.command }}</span>
                        <span [class]="styles.logOutcome(entry.ok)">{{ entry.outcome }}</span>
                    </li>
                }
            </ol>
        }
    `,
})
class Log {
    readonly entries = input.required<LogEntry[]>();
    protected readonly styles = styles;
}

/** Ids for the labels, unique per example on the page. */
let instances = 0;

@Component({
    selector: "example-middleware",
    imports: [DOCKABLE, SWITCH, ChartPanel, KpiPanel, Log],
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            <fieldset aria-label="Middleware" [class]="styles.rules">
                @for (rule of RULES; track rule.key) {
                    <span [class]="styles.rule">
                        <button
                            kitSwitch
                            [attr.aria-labelledby]="ruleId + '-' + rule.key"
                            [checked]="enabled()[rule.key]"
                            (checkedChange)="toggle(rule.key, $event)"
                        >
                            <span kitSwitchThumb></span>
                        </button>
                        <span [id]="ruleId + '-' + rule.key">{{ rule.label }}</span>
                    </span>
                }
            </fieldset>
            <div [class]="styles.tryIt">
                <button type="button" [class]="styles.button" (click)="addChart()">
                    Add a chart
                </button>
                <form [class]="styles.renameForm" (submit)="rename($event)">
                    <label [for]="nameId" [class]="styles.srOnly">New name for the selected chart</label>
                    <input
                        [id]="nameId"
                        [value]="name()"
                        (input)="name.set($any($event.target).value)"
                        [class]="styles.input"
                    />
                    <button type="submit" [class]="styles.button">Rename</button>
                </form>
                <p role="status" data-testid="result" [class]="styles.result">{{ last() }}</p>
            </div>
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
                        ></div>
                    </ng-template>
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
                            @case ("kpi") {
                                <kit-kpi-panel [label]="tab.label" [seed]="tab.data.seed" />
                            }
                            @case ("log") {
                                <example-log [entries]="log()" />
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
export default class MiddlewareExample {
    protected readonly styles = styles;
    protected readonly RULES = RULES;
    protected readonly model = createModel<Types>(json);
    protected readonly enabled = signal<Record<RuleKey, boolean>>({
        limit: true,
        tidy: true,
        log: true,
    });
    protected readonly log = signal<LogEntry[]>([]);
    protected readonly last = signal("");
    protected readonly name = signal("  quarterly   revenue report ");
    private readonly id = ++instances;
    protected readonly nameId = `middleware-${this.id}-name`;
    protected readonly ruleId = `middleware-${this.id}-rule`;

    // The log's entry ids, counted across the times the log is switched off and on.
    private nextLogId = 0;

    constructor() {
        // Each switch adds its middleware with `model.use`; the cleanup removes it with the
        // function `use` returned. The first added runs outermost, so they are added in a fixed
        // order: the log first, around the rules, so it also sees the commands a rule vetoes.
        effect((onCleanup) => {
            const enabled = this.enabled();
            const middlewares = [
                enabled.log
                    ? logCommands((entry) =>
                          this.log.update((entries) =>
                              [
                                  { ...entry, id: this.nextLogId++ },
                                  ...entries,
                              ].slice(0, 50),
                          ),
                      )
                    : undefined,
                enabled.limit ? limitTabs : undefined,
                enabled.tidy ? tidyNames : undefined,
            ];
            const removers = middlewares.flatMap((middleware) =>
                middleware ? [this.model.use(middleware)] : [],
            );
            onCleanup(() => {
                for (const remove of removers) remove();
            });
        });
    }

    protected toggle(key: RuleKey, checked: boolean) {
        this.enabled.update((current) => ({ ...current, [key]: checked }));
    }

    /** Shows a command's result from code: applied, or why it was refused. */
    private report(what: string, result: CommandResult<unknown>) {
        this.last.set(
            result.ok ? `${what}: applied` : `${what}: ${result.error.message}`,
        );
    }

    protected addChart() {
        this.report(
            "Add a chart",
            this.model.run("tab.add", {
                component: "chart",
                label: "Forecast",
                data: { kind: "area" },
                to: "charts",
                select: true,
            }),
        );
    }

    protected rename(event: Event) {
        event.preventDefault();
        const tab = this.model.get("selected-tab-by", { tabsetId: "charts" });
        if (tab?.component !== "chart") return;
        const result = this.model.run("tab.rename", {
            tabId: tab.id,
            label: this.name(),
        });
        // the name that committed is the tidied one when the rewrite is on
        const renamed = this.model.get("node-by", { id: tab.id });
        this.last.set(
            result.ok && renamed?.type === "tab"
                ? `Rename: committed as "${renamed.label}"`
                : `Rename: ${result.ok ? "applied" : result.error.message}`,
        );
    }
}
