import type { Model } from "@fragiola/dockable-vue";
import type { CounterTab, Types } from "./dockable";

/** Writes a counter tab's new count: `tab.set-data` patches it into the tab's data. */
export function setCount(model: Model<Types>, tab: CounterTab, count: number) {
    model.run("tab.set-data", { tabId: tab.id, data: { count } });
}
