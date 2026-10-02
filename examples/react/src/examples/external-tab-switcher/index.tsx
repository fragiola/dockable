"use client";

import {
    createModel,
    Dockable,
    type LayoutJson,
    type Model,
    type RowNode,
    type RowSplitterProps,
    type TabOf,
    type TabsetNode,
    useDockable,
    useModelState,
} from "@fragiola/dockable-react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import * as styles from "./styles";

// Controls outside the layout drive what is inside it. The switcher above the layout selects a
// tab (`tab.select`) and follows the selection made by clicking a tab; the stepper changes the
// counter of the tab the user is looking at (`tab.set-data`). Both go through the model only.
//
// The count lives in the tab's typed data, not in the tab's React state: that is what lets code
// outside the layout read and change it, and it moves with the tab and saves with the layout.

type Types = { tabs: { counter: { count: number } } };

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
                        label: "Alpha",
                        data: { count: 0 },
                    },
                    {
                        id: "beta",
                        component: "counter",
                        label: "Beta",
                        data: { count: 0 },
                    },
                    {
                        id: "gamma",
                        component: "counter",
                        label: "Gamma",
                        data: { count: 0 },
                    },
                ],
            },
        ],
    },
};

/** Writes a counter tab's new count: `tab.set-data` patches it into the tab's data. */
function setCount(model: Model<Types>, tab: CounterTab, count: number) {
    model.run("tab.set-data", { tabId: tab.id, data: { count } });
}

export default function ExternalTabSwitcher() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <>
            <Controls model={model} />
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
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

/** The controls outside the layout: a component of their own, so a commit re-renders them, not the layout. */
function Controls({ model }: { model: Model<Types> }) {
    const tabs = useModelState(() => model.get("tabs"), { model });
    // the tab the user is looking at: the selected tab of the active tabset (else the first)
    const current = useModelState(
        () => {
            const tabset = model.get("default-tabset");
            return tabset
                ? model.get("selected-tab-by", { tabsetId: tabset.id })
                : undefined;
        },
        { model },
    );
    return (
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
                        {tab.label}
                        <span className={styles.switchCount}>
                            {tab.data.count}
                        </span>
                    </button>
                ))}
            </fieldset>
            <fieldset aria-label="Selected counter" className={styles.stepper}>
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
                        ? `${current.label}: ${current.data.count}`
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
    );
}

/** A tab's content: its count, read from the tab's data, with its own button to add one. */
function Counter({ tab }: { tab: CounterTab }) {
    const { model } = useDockable<Types>();
    return (
        <div className={styles.counter}>
            <h2 className={styles.counterName}>{tab.label}</h2>
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
                            <span className={styles.tabName}>{tab.label}</span>
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

function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        />
    );
}
