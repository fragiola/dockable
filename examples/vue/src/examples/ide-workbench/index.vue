<script setup lang="ts">
import { veto } from "@fragiola/dockable-vue";
import { computed, onUnmounted, ref } from "vue";
import { Clickable } from "#/components/atoms/clickable";
import { AlertDialog } from "#/components/ui/alert-dialog";
import Border from "./border.vue";
import BorderContent from "./border-content.vue";
import { Dockable } from "./dockable";
import EditorPanel from "./editor-panel.vue";
import Explorer from "./explorer.vue";
import LayoutNode from "./layout-node.vue";
import ProblemsPanel from "./problems-panel.vue";
import Splitter from "./splitter.vue";
import StatusBar from "./status-bar.vue";
import * as styles from "./styles";
import TerminalPanel from "./terminal-panel.vue";
import {
    createWorkspace,
    defaultLayout,
    editorData,
    forgetLayout,
    openFile,
    restoreModel,
    saveLayout,
} from "./workspace";

// A code-editor workbench. The explorer (a start border) and the terminal and problems (a bottom
// border) are borders around the editors; the explorer and the status bar change the layout with
// commands on the model (`model.run`); the tabs follow their content (a dot while modified);
// closing a modified tab is stopped by a middleware (`model.use`), whatever closed it (button,
// menu, Ctrl+Delete); and the layout is saved on every change (`model.subscribe`, `toJSON`) and
// restored on the next visit (`createModel`, which reports a stored layout that is not valid).

const workspace = createWorkspace();
// the model, restored from storage; `problem` says why a stored layout was not used
const restored = restoreModel();
const { model } = restored;
const problem = ref(restored.problem);
// tabs waiting for an answer to "save changes?", and the ones already answered
const pending = ref<string[]>([]);
const confirmed = new Set<string>();

// The policy: closing a modified editor asks first. The middleware sees every `tab.close`,
// from any button, menu or key; it vetoes the close and queues the question, and the dialog
// runs the close again once answered. A dry run (`model.can`, which decides whether the close
// button and shortcut are offered) passes: the tab may close, after the question.
const removePolicy = model.use((ctx, next) => {
    if (ctx.command !== "tab.close" || ctx.dryRun) {
        return next();
    }
    const id = ctx.payload.tabId;
    if (!editorData(ctx.get("node-by", { id }))?.dirty) {
        return next();
    }
    if (confirmed.delete(id)) {
        return next();
    }
    if (!pending.value.includes(id)) pending.value = [...pending.value, id];
    return veto("the file has unsaved changes");
});

// every change is saved (a drag's transient steps once, at its end)
const unsubscribe = model.subscribe((event) => {
    if (!event.transient) saveLayout(model);
});

onUnmounted(() => {
    removePolicy();
    unsubscribe();
});

const open = (path: string) => openFile(model, path);

// the same model loads the default layout: open editors keep their content
const resetLayout = () => {
    forgetLayout();
    problem.value = undefined;
    model.run("layout.load", { layout: defaultLayout });
};

// answer the first pending question
const pendingNode = computed(() => {
    const id = pending.value[0];
    return id ? model.get("node-by", { id }) : undefined;
});
const pendingData = computed(() => editorData(pendingNode.value));
const answer = (choice: "save" | "discard" | "cancel") => {
    const id = pending.value[0];
    const data = pendingData.value;
    pending.value = pending.value.slice(1);
    if (!id || !data || choice === "cancel") return;
    if (choice === "save") workspace.save(data.path);
    else workspace.discard(data.path);
    confirmed.add(id);
    model.run("tab.close", { tabId: id });
};
</script>

<template>
    <div :class="styles.workbench">
        <div
            v-if="problem"
            role="alert"
            data-testid="restore-problem"
            :class="styles.restoreProblem"
        >
            <div :class="styles.restoreProblemBody">
                <p>
                    The saved layout could not be restored, so the default one
                    is shown: {{ problem.message }}
                </p>
                <ul
                    v-if="problem.issues.length > 0"
                    :class="styles.restoreProblemIssues"
                >
                    <li
                        v-for="issue in problem.issues"
                        :key="`${issue.path} ${issue.message}`"
                    >
                        {{ `${issue.path || "/"}: ${issue.message}` }}
                    </li>
                </ul>
            </div>
            <button
                type="button"
                :class="styles.restoreProblemDismiss"
                @click="problem = undefined"
            >
                Dismiss
            </button>
        </div>
        <!-- hairline splitters with a wider grab area, whatever the theme -->
        <div :class="styles.stage">
            <div :class="styles.frame">
                <Dockable.Root :model="model" :class="styles.root">
                    <Dockable.Borders>
                        <template #bar="{ border }">
                            <Border :node="border" />
                        </template>
                        <template #content="{ border }">
                            <BorderContent :node="border" />
                        </template>
                        <template #default>
                            <Dockable.Row>
                                <template #default="{ node }">
                                    <LayoutNode :node="node" />
                                </template>
                                <template #splitter="{ props }">
                                    <Splitter v-bind="props" />
                                </template>
                            </Dockable.Row>
                        </template>
                    </Dockable.Borders>
                    <Dockable.Panels v-slot="{ tab }">
                        <Dockable.Panel :node="tab" :class="styles.panel">
                            <EditorPanel
                                v-if="tab.component === 'editor'"
                                :tab="tab"
                                :workspace="workspace"
                            />
                            <TerminalPanel
                                v-else-if="tab.component === 'terminal'"
                                :workspace="workspace"
                            />
                            <ProblemsPanel
                                v-else-if="tab.component === 'problems'"
                                @open="open"
                            />
                            <Explorer
                                v-else
                                :model="model"
                                @open="open"
                                @reset-layout="resetLayout"
                            />
                        </Dockable.Panel>
                    </Dockable.Panels>
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

        <StatusBar :model="model" />

        <AlertDialog.Root
            :open="pendingData !== undefined"
            @update:open="
                (isOpen: boolean) => {
                    if (!isOpen) answer('cancel');
                }
            "
        >
            <AlertDialog.Portal>
                <AlertDialog.Backdrop />
                <AlertDialog.Content>
                    <AlertDialog.Header>
                        <AlertDialog.Title>
                            {{
                                `Save changes to ${pendingNode?.type === "tab" ? pendingNode.label : ""}?`
                            }}
                        </AlertDialog.Title>
                        <AlertDialog.Description>
                            Your changes will be lost if you close the file
                            without saving.
                        </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                        <Clickable.Button
                            variant="ghost"
                            size="sm"
                            @click="answer('discard')"
                        >
                            Don't save
                        </Clickable.Button>
                        <Clickable.Button
                            variant="outline"
                            size="sm"
                            @click="answer('cancel')"
                        >
                            Cancel
                        </Clickable.Button>
                        <Clickable.Button
                            size="sm"
                            :class="styles.saveButton"
                            @click="answer('save')"
                        >
                            Save
                        </Clickable.Button>
                    </AlertDialog.Footer>
                </AlertDialog.Content>
            </AlertDialog.Portal>
        </AlertDialog.Root>
    </div>
</template>
