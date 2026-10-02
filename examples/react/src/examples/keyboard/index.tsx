"use client";

import {
    createModel,
    type KeyMap,
    type LayoutJson,
    type RowNode,
    resolveKeyMap,
    type TabOf,
    type TabsetNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        keys: undefined;
        doc: { text: string };
        table: undefined;
        log: undefined;
    };
    // a tabset's name is its tab list's accessible name (the TabSet below reads `data.name`)
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "documents",
                data: { name: "Documents" },
                weight: 55,
                children: [
                    { component: "keys", label: "Keys" },
                    {
                        component: "doc",
                        label: "Readme",
                        data: {
                            text: "Every part of the layout is reachable without a mouse: the tab strips, the splitters and each tab's content. The Keys tab lists them all.",
                        },
                    },
                    {
                        component: "doc",
                        label: "License",
                        data: {
                            text: "MIT. Permission is hereby granted, free of charge, to any person obtaining a copy of this software, to deal in the software without restriction.",
                        },
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                data: { name: "Tools" },
                weight: 45,
                children: [
                    { component: "table", label: "Search" },
                    { component: "log", label: "History" },
                ],
            },
        ],
    },
    active: "documents",
};

/**
 * The command shortcuts, merged over `defaultKeyMap` (closeTab: Ctrl+Delete). Tabset cycling
 * and the tab/content toggle are off by default; this example turns them on. Pick modified
 * keys: single printable characters must be remappable (WCAG 2.1.4). The arrows, Home/End,
 * Enter and Space are the ARIA patterns' own keys and are not configurable.
 */
const keyMap: KeyMap = {
    focusNextTabset: "Ctrl+Alt+ArrowRight",
    focusPreviousTabset: "Ctrl+Alt+ArrowLeft",
    focusTabToggle: "Ctrl+Enter",
};
const keys = resolveKeyMap(keyMap);

export default function Keyboard() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <Tooltip.Provider>
            <div className={styles.frame}>
                <Dockable.Root
                    model={model}
                    // the shortcuts above, merged over the defaults
                    keyMap={keyMap}
                    className={styles.root}
                >
                    <Dockable.Row<Types>
                        renderSplitter={(props) => <Splitter {...props} />}
                    >
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel node={tab} className={styles.panel}>
                                {tab.component === "keys" ? (
                                    <KeysPanel />
                                ) : tab.component === "doc" ? (
                                    <PanelBody title={tab.label}>
                                        <p>{tab.data.text}</p>
                                    </PanelBody>
                                ) : tab.component === "table" ? (
                                    <TablePanel />
                                ) : (
                                    <LogPanel />
                                )}
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
        </Tooltip.Provider>
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

/** A tabset: a card with the strip of tabs on top and the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    // the tabset's name, from its data (a tabset made by a drop has none)
                    aria-label={node.data?.name || "Tabs"}
                    className={styles.tabList}
                >
                    {(tab) => <KeyboardTab tab={tab} />}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * Each tab is a Tooltip trigger. `Tooltip.Trigger render={…}` merges its props (hover and focus
 * handlers, `aria-describedby`, the ref) into the tab, so the tooltip opens when the tab gets
 * keyboard focus too. It lists the tab's `aria-keyshortcuts`: the package advertises the same
 * bindings it handles, so what the tooltip reads is what the keyboard does.
 */
function KeyboardTab({ tab }: { tab: TabOf<Types> }) {
    const { model } = useDockable<Types>();
    // the same two bindings `Dockable.Tab` puts in its aria-keyshortcuts; the model says
    // whether the tab may close (a dry run of `tab.close`)
    const closeable = model.can("tab.close", { tabId: tab.id });
    const shortcuts = [
        { name: "Enter or leave the content", spec: keys.focusTabToggle },
        { name: "Close", spec: closeable ? keys.closeTab : undefined },
    ].filter((item) => item.spec !== undefined);
    return (
        <Tooltip.Root>
            <Tooltip.Trigger
                render={
                    <Dockable.Tab node={tab} className={styles.tab}>
                        <span className={styles.tabName}>{tab.label}</span>
                        {/* the active tabset's marker */}
                        <span aria-hidden="true" className={styles.tabMarker} />
                    </Dockable.Tab>
                }
            />
            <Tooltip.Content>
                <div data-testid="tab-shortcuts" className={styles.shortcuts}>
                    {shortcuts.map((item) => (
                        <div key={item.name} className={styles.shortcut}>
                            <span>{item.name}</span>
                            <code className={styles.shortcutKeys}>
                                {toAriaKeyShortcuts(item.spec)}
                            </code>
                        </div>
                    ))}
                </div>
            </Tooltip.Content>
        </Tooltip.Root>
    );
}

/** `"Control+Alt+ArrowRight"` → `["Control", "Alt", "ArrowRight"]`, for `<kbd>` rendering. */
function Keys({ spec }: { spec: string | undefined }) {
    const aria = toAriaKeyShortcuts(spec);
    if (!aria) return null;
    return (
        <span className={styles.keys}>
            {aria.split("+").map((key) => (
                <kbd key={key} className={styles.key}>
                    {key}
                </kbd>
            ))}
        </span>
    );
}

const LEGEND: { keys: string[]; does: string }[] = [
    { keys: ["Tab"], does: "Between the tab strips and the splitters" },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "Previous or next tab in the strip",
    },
    { keys: ["Home", "End"], does: "First or last tab" },
    {
        keys: ["Enter", "Space"],
        does: "Select the focused tab; on the selected one, enter its content",
    },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "On a focused splitter: resize",
    },
];

/** A panel listing every key, fixed and configured. */
function KeysPanel() {
    return (
        <PanelBody title="Keyboard">
            <dl className={styles.legend}>
                {LEGEND.map((row) => (
                    <div key={row.does} className={styles.legendRow}>
                        <dt className={styles.legendKeys}>
                            {row.keys.map((key) => (
                                <Keys key={key} spec={key} />
                            ))}
                        </dt>
                        <dd className={styles.legendAction}>{row.does}</dd>
                    </div>
                ))}
                <dt>
                    <Keys spec={keys.focusNextTabset} />
                </dt>
                <dd className={styles.legendAction}>
                    Next tabset, from anywhere in the layout
                </dd>
                <dt>
                    <Keys spec={keys.focusPreviousTabset} />
                </dt>
                <dd className={styles.legendAction}>Previous tabset</dd>
                <dt>
                    <Keys spec={keys.focusTabToggle} />
                </dt>
                <dd className={styles.legendAction}>
                    Between a tab and its content
                </dd>
                <dt>
                    <Keys spec={keys.closeTab} />
                </dt>
                <dd className={styles.legendAction}>Close the focused tab</dd>
            </dl>
        </PanelBody>
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
