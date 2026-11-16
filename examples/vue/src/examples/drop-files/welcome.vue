<script setup lang="ts">
import {
    Braces,
    FileSpreadsheet,
    FileText,
    ImageIcon,
    Upload,
} from "@lucide/vue";
import * as styles from "./styles";

// What a tab shows for each kind of file (this and the other viewers). None of this is Dockable:
// a panel renders whatever the app gives it.
//
// The first tab: where to drop, and what each kind of file becomes.
</script>

<template>
    <div :class="styles.welcome">
        <div :class="styles.dropTarget">
            <Upload aria-hidden="true" :class="styles.dropIcon" />
            <p :class="styles.dropTitle">Drop files from your desktop</p>
            <p :class="styles.dropText">
                On a tabset to open them there, on its edge to split it, or on
                the layout's edge to dock them.
            </p>
            <ul :class="styles.kinds">
                <li :class="styles.kind">
                    <FileSpreadsheet aria-hidden="true" :class="styles.kindIcon" />
                    A CSV opens as a table, with a chart of its numbers
                </li>
                <li :class="styles.kind">
                    <ImageIcon aria-hidden="true" :class="styles.kindIcon" />
                    An image opens in a viewer
                </li>
                <li :class="styles.kind">
                    <Braces aria-hidden="true" :class="styles.kindIcon" />
                    A saved layout (.json) replaces this one
                </li>
                <li :class="styles.kind">
                    <FileText aria-hidden="true" :class="styles.kindIcon" />
                    Anything else shows its name, type and size
                </li>
            </ul>
        </div>
    </div>
</template>
