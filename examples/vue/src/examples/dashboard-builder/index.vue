<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    LayoutValidationError,
    type Middleware,
    type Model,
    veto,
} from "@fragiola/dockable-vue";
import { RotateCcw, Save } from "@lucide/vue";
import { ref, watch } from "vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import PaletteItem from "./PaletteItem.vue";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";
import WidgetContent from "./WidgetContent.vue";
import { GROUPS, isKpi, WIDGETS } from "./widgets";

const STORAGE_KEY = "dockable-examples:dashboard-builder:v2";

/** A KPI strip on top (it only takes KPIs), and an empty canvas for everything else. */
const EMPTY: LayoutJson<Types> = {
    version: 1,
    // the canvas stays when its last widget leaves
    defaults: { tabset: { deleteWhenEmpty: false } },
    root: {
        type: "row",
        children: [
            {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "kpis",
                        data: { name: "KPI strip" },
                        weight: 30,
                        minHeight: 130,
                        children: [
                            {
                                component: "kpi-revenue",
                                label: "Revenue",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "canvas",
                        data: { name: "Canvas" },
                        weight: 70,
                        children: [],
                    },
                ],
            },
        ],
    },
};

/**
 * The drop rules, as middleware: KPIs only into the centre of the KPI strip, and nothing else into
 * it (nor beside it); a tabset that holds KPIs may be docked elsewhere, never merged into another
 * tabset. They guard the commands that place a tab (`tab.add` from the palette, `tab.move` inside
 * the layout) or a tabset (`tabset.move`), from a drag or from code alike; a drag asks them with
 * `model.can` on every hover, so a refused target shows no drop indicator.
 */
const dropRules: Middleware<Types> = (ctx, next) => {
    if (ctx.command === "tabset.move") {
        const { tabsetId, to, location = "center" } = ctx.payload;
        const moved = ctx.get("node-by", { id: tabsetId });
        const carriesKpis =
            moved?.type === "tabset" &&
            moved.children.some((tab) => isKpi(tab.component));
        if (carriesKpis) {
            return location === "center" && to !== "kpis"
                ? veto("KPIs go in the KPI strip")
                : next();
        }
        return to === "kpis" ? veto("The KPI strip takes KPIs only") : next();
    }
    // the placed tab's component: a new tab's (tab.add) or an existing one's (tab.move)
    let component: string | undefined;
    if (ctx.command === "tab.add") {
        component = ctx.payload.component;
    } else if (ctx.command === "tab.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabId });
        component = moved?.type === "tab" ? moved.component : undefined;
    } else {
        return next();
    }
    const { to, location = "center" } = ctx.payload;
    const intoKpis = to === "kpis";
    if (component !== undefined && isKpi(component)) {
        return intoKpis && location === "center"
            ? next()
            : veto("KPIs go in the KPI strip");
    }
    return intoKpis ? veto("The KPI strip takes KPIs only") : next();
};

/** What was restored from storage, and why a saved layout could not be. */
interface Restored {
    model: Model<Types>;
    error?: { message: string; issues: string[] } | undefined;
}

function describe(error: unknown): NonNullable<Restored["error"]> {
    if (error instanceof LayoutValidationError) {
        // every problem, with its JSON path in the saved document
        return {
            message: error.message,
            issues: error.issues.map(
                (issue) => `${issue.path || "/"}: ${issue.message}`,
            ),
        };
    }
    return {
        message: error instanceof Error ? error.message : String(error),
        issues: [],
    };
}

/** The saved layout (JSON v1, from `model.get("layout-json")`), or the empty dashboard. */
function restore(): Restored {
    let saved: string | null = null;
    try {
        saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // no storage: start empty
    }
    let restored: Restored;
    try {
        // createModel validates the document: invalid JSON, or a layout that is not v1 (saved by
        // an older version, edited by hand), throws, and the dashboard starts empty
        restored = {
            model: createModel<Types>(saved ? JSON.parse(saved) : EMPTY),
        };
    } catch (error) {
        restored = { model: createModel<Types>(EMPTY), error: describe(error) };
    }
    restored.model.use(dropRules);
    return restored;
}

// the model is created once (never in a ref); Reset loads the empty layout into it
const initial = restore();
const model = initial.model;
const restoreError = ref(initial.error);
const saved = ref(false);

watch(saved, (isSaved, _, onCleanup) => {
    if (!isSaved) return;
    const timer = setTimeout(() => {
        saved.value = false;
    }, 1500);
    onCleanup(() => clearTimeout(timer));
});

const save = () => {
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            // the layout document (JSON v1): what createModel and layout.load read back
            JSON.stringify(model.get("layout-json")),
        );
        saved.value = true;
    } catch {
        // storage unavailable: nothing to save to
    }
};
const reset = () => {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // storage unavailable
    }
    // the same model, a new state: the rules stay installed
    model.run("layout.load", { layout: EMPTY });
    restoreError.value = undefined;
};
</script>

<template>
    <div :class="styles.page">
        <div :class="styles.toolbar">
            <h2 :class="styles.title">Sales dashboard</h2>
            <div :class="styles.actions">
                <button type="button" :class="styles.button" @click="reset">
                    <RotateCcw aria-hidden="true" :class="styles.buttonIcon" />
                    Reset
                </button>
                <button
                    type="button"
                    :class="styles.primaryButton"
                    @click="save"
                >
                    <Save aria-hidden="true" :class="styles.buttonIcon" />
                    {{ saved ? "Saved" : "Save layout" }}
                </button>
            </div>
        </div>
        <div v-if="restoreError" role="alert" :class="styles.alert">
            <p>
                {{
                    `The saved layout could not be restored: ${restoreError.message}`
                }}
            </p>
            <ul v-if="restoreError.issues.length > 0" :class="styles.issues">
                <li
                    v-for="issue in restoreError.issues.slice(0, 5)"
                    :key="issue"
                >
                    {{ issue }}
                </li>
            </ul>
        </div>
        <div :class="styles.body">
            <aside aria-label="Widget palette" :class="styles.widgetPalette">
                <section
                    v-for="group in GROUPS"
                    :key="group"
                    :aria-labelledby="`palette-${group}`"
                >
                    <h3 :id="`palette-${group}`" :class="styles.groupTitle">
                        {{ group }}
                    </h3>
                    <ul :class="styles.groupList">
                        <PaletteItem
                            v-for="widget in WIDGETS.filter(
                                (widget) => widget.group === group,
                            )"
                            :key="widget.component"
                            :model="model"
                            :widget="widget"
                        />
                    </ul>
                </section>
                <p :class="styles.paletteHint">
                    KPIs go in the strip on top; everything else goes below.
                </p>
            </aside>
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
                            <WidgetContent :tab="tab" />
                        </Dockable.Panel>
                    </Dockable.Panels>
                    <!-- Where a dragged widget would land (hidden where the rules refuse it). -->
                    <Dockable.DropIndicator>
                        <template #render="{ props, state }">
                            <div
                                v-bind="props"
                                :class="styles.dropIndicator(state)"
                            />
                        </template>
                    </Dockable.DropIndicator>
                </Dockable.Root>
            </div>
        </div>
    </div>
</template>
