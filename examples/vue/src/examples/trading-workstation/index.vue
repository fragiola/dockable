<script setup lang="ts">
import { useModelState } from "@fragiola/dockable-vue";
import { Pause, Play, RotateCcw } from "@lucide/vue";
import { onUnmounted, ref, watchEffect } from "vue";
import { createTradingFeed, prefersReducedMotion } from "../_kit/trading";
import Account from "./account.vue";
import Border from "./border.vue";
import BorderContent from "./border-content.vue";
import Content from "./content.vue";
import { Dockable } from "./dockable";
import LayoutNode from "./layout-node.vue";
import Splitter from "./splitter.vue";
import * as styles from "./styles";
import {
    defaultLayout,
    forgetLayout,
    knownSymbol,
    restoreModel,
    saveLayout,
    selectedSymbol,
    selectSymbol,
    trackBadges,
} from "./workspace";

// A trading desk of dockable panels, all live: a seeded feed ticks a few times a second while
// playing (paused from the start under reduced motion, and skipped while the page is hidden).
// The watchlist chooses the instrument the chart and the order book follow, kept in the chart
// tab's data and its name (`tab.set-data`, `tab.rename`); the positions and news tabs show badges
// their data carries. Every panel can be dragged to another tabset, an edge or the bottom border,
// maximized or popped out into a window, and keeps ticking there: moving a tab never remounts its
// content. The layout is saved on every change and restored on the next visit.

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

// the feed and the model, created once (never in a ref)
const feed = createTradingFeed();
const model = restoreModel(knownSymbol(feed));
const playing = ref(!prefersReducedMotion());

// the feed: ticking while playing (after the mount: `flush: "post"`), and always stopped on
// unmount (the cleanup also runs when `playing` changes)
watchEffect(
    (onCleanup) => {
        if (playing.value) onCleanup(feed.start());
    },
    { flush: "post" },
);
// the tabs' badges follow the feed and the model
const stopBadges = trackBadges(model, feed);
// every change is saved (a drag's transient steps once, at its end)
const unsubscribe = model.subscribe((event) => {
    if (!event.transient) saveLayout(model);
});
onUnmounted(() => {
    stopBadges();
    unsubscribe();
});

// the instrument the desk follows is the chart tab's: a commit updates the panels
const symbol = useModelState(() => selectedSymbol(model), { model });
const select = (next: string) => selectSymbol(model, next);

// the same model loads the default layout: the panels keep their content
const resetLayout = () => {
    forgetLayout();
    model.run("layout.load", { layout: defaultLayout });
};
</script>

<template>
    <div :class="styles.shell">
        <div :class="styles.toolbar">
            <button type="button" :class="styles.button" @click="playing = !playing">
                <Pause v-if="playing" aria-hidden="true" :class="styles.buttonIcon" />
                <Play v-else aria-hidden="true" :class="styles.buttonIcon" />
                {{ playing ? "Pause" : "Play" }}
            </button>
            <span data-testid="feed-state" :class="styles.feedState(playing)">
                <span aria-hidden="true" :class="styles.feedDot(playing)" />
                {{ playing ? "Live" : "Paused" }}
            </span>
            <Account :feed="feed" />
            <button type="button" :class="styles.ghostButton" @click="resetLayout">
                <RotateCcw aria-hidden="true" :class="styles.buttonIcon" />
                Reset layout
            </button>
        </div>
        <div :class="styles.frame">
            <!-- popout-mirror-root copies <html> and <body>'s attributes (the example theme) into
                 each window -->
            <Dockable.Root
                :model="model"
                :popoutURL="popoutURL"
                popout-mirror-root
                :class="styles.root"
            >
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
                <!-- every tab's content, here or in a popout, positioned by the engine -->
                <Dockable.Panels v-slot="{ tab }">
                    <Dockable.Panel :node="tab" :class="styles.panel">
                        <Content
                            :tab="tab"
                            :feed="feed"
                            :symbol="symbol"
                            @select="select"
                        />
                    </Dockable.Panel>
                </Dockable.Panels>
                <Dockable.DropIndicator>
                    <template #render="{ props, state }">
                        <div v-bind="props" :class="styles.dropIndicator(state)" />
                    </template>
                </Dockable.DropIndicator>
                <!-- each popout window: its own rows and drop outline -->
                <Dockable.Popout :class="styles.popout">
                    <Dockable.Row>
                        <template #default="{ node }">
                            <LayoutNode :node="node" />
                        </template>
                        <template #splitter="{ props }">
                            <Splitter v-bind="props" />
                        </template>
                    </Dockable.Row>
                    <Dockable.DropIndicator>
                        <template #render="{ props, state }">
                            <div
                                v-bind="props"
                                :class="styles.dropIndicator(state)"
                            />
                        </template>
                    </Dockable.DropIndicator>
                </Dockable.Popout>
            </Dockable.Root>
        </div>
    </div>
</template>
