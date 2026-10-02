"use client";

import {
    createModel,
    type LayoutJson,
    type Model,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { useState } from "react";
import * as styles from "./styles";
import {
    iconOf,
    type Types,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetTab,
} from "./widgets";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [{ component: "revenue", label: "Revenue chart" }],
            },
            {
                type: "tabset",
                weight: 40,
                children: [{ component: "orders", label: "Orders table" }],
            },
        ],
    },
};

export default function WidgetSidebar() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("");
    // the new tab's id, or undefined when the add was refused
    const onAdded = (id: string | undefined) => {
        const tab = id === undefined ? undefined : model.get("node-by", { id });
        setStatus(tab?.type === "tab" ? `Added ${tab.label}` : "Nothing added");
    };

    return (
        <div className={styles.page}>
            <aside aria-label="Widgets" className={styles.sidebar}>
                <h2 className={styles.sidebarTitle}>Widgets</h2>
                <ul className={styles.widgetList}>
                    {WIDGETS.map((widget) => (
                        <li key={widget.component}>
                            <WidgetSource
                                model={model}
                                widget={widget}
                                onAdded={onAdded}
                            />
                        </li>
                    ))}
                </ul>
                <p role="status" data-testid="status" className={styles.status}>
                    {status}
                </p>
            </aside>
            {/* The root needs a size: the wrapper gives it one, and the gutter around it. */}
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
                                <WidgetContent tab={tab} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land, animated at the layout's drag speed. */}
                    <Dockable.DropIndicator
                        className={styles.dropIndicator}
                        style={(state) => ({
                            transitionDuration: `${state.tabDragSpeed}s`,
                        })}
                    />
                </Dockable.Root>
            </div>
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

/** A tabset: a card with the strip of tabs (each with its widget's icon) on top. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => {
                        const Icon = iconOf(tab);
                        return (
                            <Dockable.Tab node={tab} className={styles.tab}>
                                {Icon ? (
                                    <Icon
                                        aria-hidden
                                        className={styles.tabIcon}
                                    />
                                ) : null}
                                <span className={styles.tabName}>
                                    {tab.label}
                                </span>
                                {/* the active tabset's marker */}
                                <span
                                    aria-hidden="true"
                                    className={styles.tabMarker}
                                />
                            </Dockable.Tab>
                        );
                    }}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** A widget in the sidebar: drag it into the layout, or click it (keyboard: Enter) to add it. */
function WidgetSource({
    model,
    widget,
    onAdded,
}: {
    model: Model<Types>;
    widget: Widget;
    onAdded: (tab: string | undefined) => void;
}) {
    const Icon = widget.icon;

    // Native drag and drop has no keyboard path, so a click adds the widget to the active
    // tabset. `tab.add` runs on the model, through its middleware, like the drop does.
    const addToActiveTabset = () => {
        const target = model.get("active-tabset") ?? model.get("tabsets")[0];
        if (!target) return;
        const added = model.run("tab.add", {
            ...widgetTab(widget),
            to: target.id,
            select: true,
        });
        onAdded(added.ok ? added.value.tabId : undefined);
    };

    return (
        <Dockable.DragSource
            model={model}
            tab={() => widgetTab(widget)}
            onDrop={(tab) => onAdded(tab)}
            render={<button type="button" onClick={addToActiveTabset} />}
            aria-description="Drag into the layout, or press to add to the active tabset"
            className={styles.widget}
        >
            <span className={styles.widgetIconBox}>
                <Icon aria-hidden className={styles.widgetIcon} />
            </span>
            <span className={styles.widgetText}>
                <span className={styles.widgetTitle}>{widget.title}</span>
                <span className={styles.widgetDescription}>
                    {widget.description}
                </span>
            </span>
        </Dockable.DragSource>
    );
}

/** The bar between two children of a row, with a grip for the themes that show one. */
function Splitter(props: RowSplitterProps<Types>) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
