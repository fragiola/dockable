"use client";

import {
    type CommandResult,
    createModel,
    Dockable,
    type LayoutJson,
    type Middleware,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Switch } from "#/components/ui/switch";
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
    // `ctx.command` narrows the payload: a rename is `tab.configure` with a label
    if (ctx.command === "tab.configure" && ctx.payload.label !== undefined) {
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

export default function MiddlewareExample() {
    const [model] = useState(() => createModel<Types>(json));
    const [enabled, setEnabled] = useState<Record<RuleKey, boolean>>({
        limit: true,
        tidy: true,
        log: true,
    });
    const [log, setLog] = useState<LogEntry[]>([]);
    const [last, setLast] = useState("");
    const [name, setName] = useState("  quarterly   revenue report ");
    const nameId = useId();
    const ruleId = useId();

    // The log's entry ids, counted across the times the log is switched off and on.
    const nextLogId = useRef(0);

    // Each switch adds its middleware with `model.use`; the cleanup removes it with the function
    // `use` returned. The first added runs outermost, so they are added in a fixed order: the log
    // first, around the rules, so it also sees the commands a rule vetoes.
    useEffect(() => {
        const middlewares = [
            enabled.log
                ? logCommands((entry) =>
                      setLog((entries) =>
                          [
                              { ...entry, id: nextLogId.current++ },
                              ...entries,
                          ].slice(0, 50),
                      ),
                  )
                : undefined,
            enabled.limit ? limitTabs : undefined,
            enabled.tidy ? tidyNames : undefined,
        ];
        const removers = middlewares.flatMap((middleware) =>
            middleware ? [model.use(middleware)] : [],
        );
        return () => {
            for (const remove of removers) remove();
        };
    }, [model, enabled.log, enabled.limit, enabled.tidy]);

    /** Shows a command's result from code: applied, or why it was refused. */
    const report = (what: string, result: CommandResult<unknown>) =>
        setLast(
            result.ok ? `${what}: applied` : `${what}: ${result.error.message}`,
        );

    const addChart = () =>
        report(
            "Add a chart",
            model.run("tab.add", {
                component: "chart",
                label: "Forecast",
                data: { kind: "area" },
                to: "charts",
                select: true,
            }),
        );

    const rename = (event: FormEvent) => {
        event.preventDefault();
        const tab = model.get("selected-tab-by", { tabsetId: "charts" });
        if (tab?.component !== "chart") return;
        const result = model.run("tab.configure", {
            tabId: tab.id,
            label: name,
        });
        // the name that committed is the tidied one when the rewrite is on
        const renamed = model.get("node-by", { id: tab.id });
        setLast(
            result.ok && renamed?.type === "tab"
                ? `Rename: committed as "${renamed.label}"`
                : `Rename: ${result.ok ? "applied" : result.error.message}`,
        );
    };

    return (
        <>
            <div className={styles.toolbar}>
                <fieldset aria-label="Middleware" className={styles.rules}>
                    {RULES.map((rule) => (
                        <span key={rule.key} className={styles.rule}>
                            <Switch.Root
                                aria-labelledby={`${ruleId}-${rule.key}`}
                                checked={enabled[rule.key]}
                                onCheckedChange={(checked) =>
                                    setEnabled((current) => ({
                                        ...current,
                                        [rule.key]: checked,
                                    }))
                                }
                            >
                                <Switch.Thumb />
                            </Switch.Root>
                            <span id={`${ruleId}-${rule.key}`}>
                                {rule.label}
                            </span>
                        </span>
                    ))}
                </fieldset>
                <div className={styles.tryIt}>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={addChart}
                    >
                        Add a chart
                    </button>
                    <form className={styles.renameForm} onSubmit={rename}>
                        <label htmlFor={nameId} className={styles.srOnly}>
                            New name for the selected chart
                        </label>
                        <input
                            id={nameId}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            className={styles.input}
                        />
                        <button type="submit" className={styles.button}>
                            Rename
                        </button>
                    </form>
                    <p
                        role="status"
                        data-testid="result"
                        className={styles.result}
                    >
                        {last}
                    </p>
                </div>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Content tab={tab} log={log} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

function Content({ tab, log }: { tab: TabOf<Types>; log: LogEntry[] }) {
    switch (tab.component) {
        case "chart":
            return (
                <ChartPanel
                    kind={tab.data.kind}
                    seed={tab.label.length}
                    title={tab.label}
                />
            );
        case "kpi":
            return <KpiPanel label={tab.label} seed={tab.data.seed} />;
        case "log":
            return <Log entries={log} />;
    }
}

/** What the observing middleware wrote, newest first. */
function Log({ entries }: { entries: LogEntry[] }) {
    if (entries.length === 0) {
        return <p className={styles.logEmpty}>Commands appear here.</p>;
    }
    return (
        <ol aria-label="Command log" className={styles.log}>
            {entries.map((entry) => (
                <li key={entry.id} className={styles.logEntry}>
                    <span className={styles.logCommand}>{entry.command}</span>
                    <span className={styles.logOutcome(entry.ok)}>
                        {entry.outcome}
                    </span>
                </li>
            ))}
        </ol>
    );
}

function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
