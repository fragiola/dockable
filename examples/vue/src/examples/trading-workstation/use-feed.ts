import { onUnmounted, type Ref, shallowRef } from "vue";
import type { Snapshot, TradingFeed } from "../_kit/trading";

// Every panel reads the feed through this composable: it subscribes, and unsubscribes when the
// panel unmounts, so a panel keeps ticking wherever its tab is moved: another tabset, the border,
// a maximized tabset or a popout window.

/** The feed's current snapshot, as a ref that follows it. */
export function useFeed(feed: TradingFeed): Readonly<Ref<Snapshot>> {
    const snapshot = shallowRef(feed.getSnapshot());
    onUnmounted(
        feed.subscribe(() => {
            snapshot.value = feed.getSnapshot();
        }),
    );
    return snapshot;
}

/** Up, down or flat, as the tone the styles colour. */
export const toneOf = (value: number) =>
    value > 0 ? "up" : value < 0 ? "down" : "flat";
