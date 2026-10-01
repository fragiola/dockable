"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import * as styles from "./styles";

// Controls outside the layout drive what is inside it. The switcher above the layout selects a
// tab (`tab.select`) and follows the selection made by clicking a tab; the stepper changes the
// counter of the tab the user is looking at (`tab.update`). Both go through the model only.
//
// The count lives in the tab's typed data, not in the tab's React state: that is what lets code
// outside the layout read and change it, and it moves with the tab and saves with the layout.

type Types = { tabs: { counter: { name: string; count: number } } };

type CounterTab = TabOf<Types>;

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    {
                        id: "alpha",
                        component: "counter",
                        data: { name: "Alpha", count: 0 },
                    },
                    {
                        id: "beta",
                        component: "counter",
                        data: { name: "Beta", count: 0 },
                    },
                    {
                        id: "gamma",
                        component: "counter",
                        data: { name: "Gamma", count: 0 },
                    },
                ],
            },
        ],
    },
};

/** Writes a counter tab's new count: `tab.update` replaces the tab's whole data. */
function setCount(model: Model<Types>, tab: CounterTab, count: number) {
    model.run("tab.update", {
        tabId: tab.id,
        component: "counter",
        data: { ...tab.data, count },
    });
}

export default function ExternalTabSwitcher() {
    const [model] = useState(() => createModel<Types>(json));
    // This component is outside Dockable.Root: it re-renders on every commit through `subscribe`,
    // then reads what it shows with `model.get`.
    useSyncExternalStore(model.subscribe, () => model.state);
    const tabs = model.get("tabs");
    // "the tab the user is looking at": the selected tab of the active tabset (the first tabset
    // until one is activated)
    const tabset = model.get("active-tabset") ?? model.get("tabsets")[0];
    const current = tabset
        ? model.get("selected-tab-by", { tabsetId: tabset.id })
        : undefined;
    return (
        <>
            <div className={styles.controls}>
                <fieldset aria-label="Show tab" className={styles.switcher}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            aria-pressed={tab.id === current?.id}
                            className={styles.switchButton}
                            onClick={() =>
                                model.run("tab.select", { tabId: tab.id })
                            }
                        >
                            {tab.data.name}
                            <span className={styles.switchCount}>
                                {tab.data.count}
                            </span>
                        </button>
                    ))}
                </fieldset>
                <fieldset
                    aria-label="Selected counter"
                    className={styles.stepper}
                >
                    <button
                        type="button"
                        aria-label="Decrement"
                        disabled={!current}
                        className={styles.stepButton}
                        onClick={() =>
                            current &&
                            setCount(model, current, current.data.count - 1)
                        }
                    >
                        <Minus aria-hidden="true" className={styles.icon} />
                    </button>
                    <output
                        data-testid="outside-count"
                        className={styles.stepValue}
                    >
                        {current
                            ? `${current.data.name}: ${current.data.count}`
                            : "No tab"}
                    </output>
                    <button
                        type="button"
                        aria-label="Increment"
                        disabled={!current}
                        className={styles.stepButton}
                        onClick={() =>
                            current &&
                            setCount(model, current, current.data.count + 1)
                        }
                    >
                        <Plus aria-hidden="true" className={styles.icon} />
                    </button>
                    <button
                        type="button"
                        aria-label="Reset"
                        disabled={!current}
                        className={styles.stepButton}
                        onClick={() => current && setCount(model, current, 0)}
                    >
                        <RotateCcw aria-hidden="true" className={styles.icon} />
                    </button>
                </fieldset>
            </div>
            <div className={styles.frame}>
                <Dockable.Root model={model} className={styles.root}>
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                <Counter tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator
                        className={styles.dropIndicator}
                        style={(state) => ({
                            transitionDuration: `${state.tabDragSpeed}s`,
                        })}
                    />
                </Dockable.Root>
            </div>
        </>
    );
}

/** A tab's content: its count, read from the tab's data, with its own button to add one. */
function Counter({ tab }: { tab: CounterTab }) {
    const { model } = useDockable<Types>();
    return (
        <div className={styles.counter}>
            <h2 className={styles.counterName}>{tab.data.name}</h2>
            <p data-testid="count" className={styles.counterValue}>
                {tab.data.count}
            </p>
            <button
                type="button"
                className={styles.counterButton}
                onClick={() => setCount(model, tab, tab.data.count + 1)}
            >
                Add one
            </button>
        </div>
    );
}

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <TabSet node={node} />;
}

/** A tabset: the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Counters"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
                            <span className={styles.tabCount}>
                                {tab.data.count}
                            </span>
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row (a drag to an edge splits the tabset). */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
