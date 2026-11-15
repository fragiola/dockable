<script setup lang="ts">
import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Middleware,
    type TabAddPayload,
    type TabJson,
    type TabOf,
    veto,
} from "@fragiola/dockable-vue";
import { Lock } from "@lucide/vue";
import { ref } from "vue";
import Content from "./Content.vue";
import { Dockable, type Types } from "./dockable";
import LayoutNode from "./LayoutNode.vue";
import { CONSOLE, LOCKED, REFERENCE } from "./regions";
import Splitter from "./Splitter.vue";
import * as styles from "./styles";

// Stop drops into part of the layout, in two layers:
//
// 1. A middleware (`model.use`) on the commands that place a tab or tabset: `tab.move`,
//    `tabset.move` and `tab.add`. Here the "Reference" tabset takes only tabs whose
//    `data.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. It runs for every command, whoever issues it: a
//    drag asks it on every hover with `model.can` (a dry run, `ctx.dryRun`), so over a refused
//    target the outline hides, the browser shows its "not allowed" cursor, and the target
//    tabset and the root get `data-drop-refused`; a drop, or a command run from code, is vetoed
//    the same way. Each tabset styles its own `data-drop-refused`: the whole region turns red,
//    with a lock in its middle, for as long as the drag hovers it.
// 2. Node flags: the "Console" tabset has `droppable: false` (nothing merges into it) and
//    `splittable: false` (nothing splits it), and its tabs `draggable: false`.
//

const doc = (name: string, region: string): TabJson<Types> => ({
    component: "doc",
    label: name,
    data: { region },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: REFERENCE,
                data: { name: "Reference" },
                weight: 30,
                children: [
                    doc("Spec", "reference"),
                    doc("Glossary", "reference"),
                ],
            },
            {
                type: "tabset",
                id: "workspace",
                data: { name: "Workspace" },
                weight: 45,
                children: [
                    doc("Draft", "workspace"),
                    // belongs to the reference region: it may be dropped there
                    doc("API reference", "reference"),
                    doc("Notes", "workspace"),
                ],
            },
            {
                type: "tabset",
                id: CONSOLE,
                data: { name: "Console" },
                weight: 25,
                droppable: false,
                splittable: false,
                children: [
                    {
                        component: "console",
                        label: "Console",
                        draggable: false,
                    },
                    {
                        component: "console",
                        label: "Output",
                        draggable: false,
                    },
                ],
            },
        ],
    },
};

/** A tab's region: only documents have one. */
function regionOf(tab: TabOf<Types> | TabAddPayload<Types> | undefined) {
    return tab?.component === "doc" ? tab.data.region : undefined;
}

/**
 * The drop rule, as middleware. Ids are stable; paths (`/ts0`) change as the layout changes.
 * `ctx.command` narrows `ctx.payload`.
 */
const lockedRegions: Middleware<Types> = (ctx, next) => {
    // what is placed: an existing tab (tab.move), a new tab (tab.add) or a tabset (tabset.move)
    let tab: TabOf<Types> | TabAddPayload<Types> | undefined;
    if (ctx.command === "tab.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabId });
        tab = moved?.type === "tab" ? moved : undefined;
    } else if (ctx.command === "tab.add") {
        tab = ctx.payload;
    } else if (ctx.command !== "tabset.move") {
        return next();
    }
    const { to, location } = ctx.payload;
    const name = tab ? `"${tab.label}"` : "a tabset";

    if (to === REFERENCE && regionOf(tab) !== REFERENCE) {
        return veto(`A middleware vetoed moving ${name} into Reference.`);
    }
    // docking at the layout's edge next to a locked tabset (`to` is the root row, or the layout)
    const target =
        to === MAIN_LAYOUT ? ctx.state.root : ctx.get("node-by", { id: to });
    if (target?.type === "row") {
        const children = target.children;
        const beside =
            location === "start"
                ? children[0]
                : location === "end"
                  ? children[children.length - 1]
                  : undefined;
        if (beside && LOCKED.has(beside.id)) {
            return veto(
                `A middleware vetoed docking ${name} beside a locked tabset.`,
            );
        }
    }
    return next();
};

// the rule is installed once, with the model: it guards every command from the start
const model = createModel<Types>(json);
model.use(lockedRegions);
const notice = ref<string | undefined>(undefined);
</script>

<template>
    <div :class="styles.toolbar">
        <Lock aria-hidden="true" :class="styles.toolbarIcon" />
        <p :class="styles.toolbarHint">
            Reference takes reference tabs only; Console takes nothing.
        </p>
        <p role="status" :class="styles.notice">{{ notice }}</p>
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
                    <Content :tab="tab" @notice="notice = $event" />
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
