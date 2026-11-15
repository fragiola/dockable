<script setup lang="ts">
import { createModel, type LayoutJson } from "@fragiola/dockable-vue";
import { Dockable, type Types } from "./dockable";
import Pane from "./Pane.vue";
import * as styles from "./styles";

// Two layouts with their own models, in one Dockable.DragGroup: drag a tab from one into the
// other. Each model's middleware sees its side (a `tab.add` in the target, a `tab.close` in the
// source, both marked `meta.transfer`), and either can refuse. The tab's content moves with it.

const card = (name: string) => ({ component: "card" as const, label: name });

const workspace: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [card("Report"), card("Chart"), card("Data")],
            },
        ],
    },
};

const scratch: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [card("Ideas")] }],
    },
};

const workspaceModel = createModel<Types>(workspace);
const scratchModel = createModel<Types>(scratch);
</script>

<template>
    <!-- one drag group around both roots: a tab dragged out of one can drop into the other -->
    <Dockable.DragGroup>
        <div :class="styles.panes">
            <Pane title="Workspace" :model="workspaceModel" />
            <Pane title="Scratch" :model="scratchModel" />
        </div>
    </Dockable.DragGroup>
</template>
