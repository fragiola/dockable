<script setup lang="ts">
import {
    type CommandResult,
    createModel,
    type LayoutJson,
    type Middleware,
    veto,
} from "@fragiola/dockable-vue";
import { reactive, ref, shallowRef, useId, watch } from "vue";
import { Switch } from "#/components/ui/switch";
import Content from "./Content.vue";
import { Dockable, type LogEntry, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import Splitter from "./Splitter.vue";
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

const model = createModel<Types>(json);
const enabled = reactive<Record<RuleKey, boolean>>({
    limit: true,
    tidy: true,
    log: true,
});
const log = shallowRef<LogEntry[]>([]);
const last = ref("");
const name = ref("  quarterly   revenue report ");
const nameId = useId();
const ruleId = useId();

// The log's entry ids, counted across the times the log is switched off and on.
let nextLogId = 0;

// Each switch adds its middleware with `model.use`; the cleanup removes it with the function
// `use` returned. The first added runs outermost, so they are added in a fixed order: the log
// first, around the rules, so it also sees the commands a rule vetoes.
watch(
    () => [enabled.log, enabled.limit, enabled.tidy] as const,
    ([logOn, limitOn, tidyOn], _previous, onCleanup) => {
        const middlewares = [
            logOn
                ? logCommands((entry) => {
                      log.value = [
                          { ...entry, id: nextLogId++ },
                          ...log.value,
                      ].slice(0, 50);
                  })
                : undefined,
            limitOn ? limitTabs : undefined,
            tidyOn ? tidyNames : undefined,
        ];
        const removers = middlewares.flatMap((middleware) =>
            middleware ? [model.use(middleware)] : [],
        );
        // also when the component unmounts
        onCleanup(() => {
            for (const remove of removers) remove();
        });
    },
    { immediate: true },
);

/** Shows a command's result from code: applied, or why it was refused. */
function report(what: string, result: CommandResult<unknown>) {
    last.value = result.ok
        ? `${what}: applied`
        : `${what}: ${result.error.message}`;
}

function addChart() {
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
}

function rename() {
    const tab = model.get("selected-tab-by", { tabsetId: "charts" });
    if (tab?.component !== "chart") return;
    const result = model.run("tab.rename", {
        tabId: tab.id,
        label: name.value,
    });
    // the name that committed is the tidied one when the rewrite is on
    const renamed = model.get("node-by", { id: tab.id });
    last.value =
        result.ok && renamed?.type === "tab"
            ? `Rename: committed as "${renamed.label}"`
            : `Rename: ${result.ok ? "applied" : result.error.message}`;
}
</script>

<template>
    <div :class="styles.toolbar">
        <fieldset aria-label="Middleware" :class="styles.rules">
            <span v-for="rule in RULES" :key="rule.key" :class="styles.rule">
                <Switch.Root
                    v-model="enabled[rule.key]"
                    :aria-labelledby="`${ruleId}-${rule.key}`"
                >
                    <Switch.Thumb />
                </Switch.Root>
                <span :id="`${ruleId}-${rule.key}`">{{ rule.label }}</span>
            </span>
        </fieldset>
        <div :class="styles.tryIt">
            <button type="button" :class="styles.button" @click="addChart">
                Add a chart
            </button>
            <form :class="styles.renameForm" @submit.prevent="rename">
                <label :for="nameId" :class="styles.srOnly">
                    New name for the selected chart
                </label>
                <input :id="nameId" v-model="name" :class="styles.input" />
                <button type="submit" :class="styles.button">Rename</button>
            </form>
            <p role="status" data-testid="result" :class="styles.result">{{ last }}</p>
        </div>
    </div>
    <div :class="styles.frame">
        <Dockable.Root :model="model" :class="styles.root">
            <Dockable.Row>
                <template #default="{ node }">
                    <LayoutNode :node="node" />
                </template>
                <template #splitter="{ props }">
                    <Splitter v-bind="props" />
                </template>
            </Dockable.Row>
            <Dockable.Panels v-slot="{ tab }">
                <Dockable.Panel :node="tab" :class="styles.panel">
                    <Content :tab="tab" :log="log" />
                </Dockable.Panel>
            </Dockable.Panels>
            <Dockable.DropIndicator>
                <template #render="{ props, state }">
                    <div v-bind="props" :class="styles.dropIndicator(state)" />
                </template>
            </Dockable.DropIndicator>
        </Dockable.Root>
    </div>
</template>
