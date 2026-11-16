<script setup lang="ts">
import { type Model, useModelState } from "@fragiola/dockable-vue";
import { ChevronRight, RotateCcw } from "@lucide/vue";
import { shallowRef } from "vue";
import type { Types } from "./dockable";
import FileIcon from "./file-icon.vue";
import { FILE_PATHS, fileName, folderOf } from "./files";
import * as styles from "./styles";
import { activePath, dirtyPaths } from "./workspace";

// The file tree. It is the content of the start border's "Explorer" tab, and opens files through
// the event it emits (the example turns that into the `tab.add` / `tab.select` commands).

const props = defineProps<{ model: Model<Types> }>();
const emit = defineEmits<{ open: [path: string]; resetLayout: [] }>();

const dirty = useModelState(() => dirtyPaths(props.model), {
    model: props.model,
});
const active = useModelState(() => activePath(props.model), {
    model: props.model,
});
const collapsed = shallowRef<ReadonlySet<string>>(new Set());
const folders = [...new Set(FILE_PATHS.map(folderOf))];

const filesIn = (folder: string) =>
    FILE_PATHS.filter((path) => folderOf(path) === folder);

const toggle = (folder: string) => {
    const next = new Set(collapsed.value);
    if (next.has(folder)) next.delete(folder);
    else next.add(folder);
    collapsed.value = next;
};
</script>

<template>
    <nav aria-label="Explorer" :class="styles.explorer">
        <div :class="styles.explorerHeader">
            Explorer
            <button
                type="button"
                aria-label="Reset the saved layout"
                title="Reset the saved layout"
                :class="styles.resetButton"
                @click="emit('resetLayout')"
            >
                <RotateCcw aria-hidden="true" :class="styles.resetIcon" />
            </button>
        </div>
        <ul :class="styles.explorerTree">
            <li v-for="folder in folders" :key="folder || '/'">
                <button
                    v-if="folder"
                    type="button"
                    :aria-expanded="!collapsed.has(folder)"
                    :class="styles.folderRow"
                    @click="toggle(folder)"
                >
                    <ChevronRight
                        aria-hidden="true"
                        :class="styles.folderChevron(!collapsed.has(folder))"
                    />
                    {{ folder }}
                </button>
                <ul v-if="!collapsed.has(folder)">
                    <li v-for="path in filesIn(folder)" :key="path">
                        <button
                            type="button"
                            data-testid="explorer-file"
                            :aria-current="path === active ? 'true' : undefined"
                            :class="styles.fileRow(Boolean(folder))"
                            @click="emit('open', path)"
                        >
                            <FileIcon :path="path" />
                            <span :class="styles.fileName">
                                {{ fileName(path) }}
                            </span>
                            <span
                                v-if="dirty.has(path)"
                                role="img"
                                aria-label="modified"
                                :class="styles.fileModified"
                            />
                        </button>
                    </li>
                </ul>
            </li>
        </ul>
    </nav>
</template>
