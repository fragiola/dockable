"use client";

import {
    type IJsonModel,
    type IKeyMap,
    Model,
    resolveKeyMap,
    type TabNode,
    type TabSetNode,
    toAriaKeyShortcuts,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { Card, PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { KitTabButton, KitTabStrip } from "../_kit/tab-strip";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                // a tabset's name is its tab list's accessible name
                name: "Documents",
                weight: 55,
                active: true,
                children: [
                    { type: "tab", name: "Keys", component: "keys" },
                    { type: "tab", name: "Readme", component: "card" },
                    {
                        type: "tab",
                        name: "License",
                        component: "card",
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                name: "Tools",
                weight: 45,
                children: [
                    { type: "tab", name: "Search", component: "card" },
                    { type: "tab", name: "History", component: "card" },
                ],
            },
        ],
    },
};

/**
 * The command shortcuts, merged over `defaultKeyMap` (closeTab: Ctrl+Delete). Tabset cycling
 * and the tab/content toggle are off by default; this example turns them on. Pick modified
 * keys: single printable characters must be remappable (WCAG 2.1.4). The arrows, Home/End,
 * Enter and Space are the ARIA patterns' own keys and are not configurable.
 */
const keyMap: IKeyMap = {
    focusNextTabset: "Ctrl+Alt+ArrowRight",
    focusPreviousTabset: "Ctrl+Alt+ArrowLeft",
    focusTabToggle: "Ctrl+Enter",
};
const keys = resolveKeyMap(keyMap);

/** `"Control+Alt+ArrowRight"` → `["Control", "Alt", "ArrowRight"]`, for `<kbd>` rendering. */
function Keys({ spec }: { spec: string | undefined }) {
    const aria = toAriaKeyShortcuts(spec);
    if (!aria) return null;
    return (
        <span className="inline-flex gap-0.5">
            {aria.split("+").map((key) => (
                <kbd
                    key={key}
                    className="rounded border border-palette-line bg-palette-soft px-1 font-mono text-xs"
                >
                    {key}
                </kbd>
            ))}
        </span>
    );
}

/**
 * Each tab is a Tooltip trigger. `Tooltip.Trigger render={…}` merges its props (hover and focus
 * handlers, `aria-describedby`, the ref) into the tab, so the tooltip opens when the tab gets
 * keyboard focus too. It lists the tab's `aria-keyshortcuts`: the package advertises the same
 * bindings it handles, so what the tooltip reads is what the keyboard does.
 */
function KeyboardTab({ tab }: { tab: TabNode }) {
    // the same two bindings `Dockable.Tab` puts in its aria-keyshortcuts
    const shortcuts = [
        { name: "Enter or leave the content", spec: keys.focusTabToggle },
        { name: "Close", spec: tab.isCloseable() ? keys.closeTab : undefined },
    ].filter((item) => item.spec !== undefined);
    return (
        <Tooltip.Root>
            <Tooltip.Trigger render={<KitTabButton node={tab} />} />
            <Tooltip.Content>
                <div data-testid="tab-shortcuts" className="grid gap-1 text-xs">
                    {shortcuts.map((item) => (
                        <div
                            key={item.name}
                            className="flex items-center justify-between gap-3"
                        >
                            <span>{item.name}</span>
                            <code className="font-mono">
                                {toAriaKeyShortcuts(item.spec)}
                            </code>
                        </div>
                    ))}
                </div>
            </Tooltip.Content>
        </Tooltip.Root>
    );
}

function TabSet({ node }: { node: TabSetNode }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <KitTabStrip tabset={node}>
                {(tab) => <KeyboardTab tab={tab} />}
            </KitTabStrip>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
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
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 text-sm">
                {LEGEND.map((row) => (
                    <div key={row.does} className="contents">
                        <dt className="flex gap-1">
                            {row.keys.map((key) => (
                                <Keys key={key} spec={key} />
                            ))}
                        </dt>
                        <dd className="m-0 text-palette-accent/85">
                            {row.does}
                        </dd>
                    </div>
                ))}
                <dt>
                    <Keys spec={keys.focusNextTabset} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Next tabset, from anywhere in the layout
                </dd>
                <dt>
                    <Keys spec={keys.focusPreviousTabset} />
                </dt>
                <dd className="m-0 text-palette-accent/85">Previous tabset</dd>
                <dt>
                    <Keys spec={keys.focusTabToggle} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Between a tab and its content
                </dd>
                <dt>
                    <Keys spec={keys.closeTab} />
                </dt>
                <dd className="m-0 text-palette-accent/85">
                    Close the focused tab
                </dd>
            </dl>
        </PanelBody>
    );
}

export default function Keyboard() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <Tooltip.Provider>
            <DockLayout
                model={model}
                rootProps={{ keyMap }}
                renderTabSet={(tabset) => <TabSet node={tabset} />}
                renderContent={(tab) =>
                    tab.getComponent() === "keys" ? (
                        <KeysPanel />
                    ) : (
                        <Card tab={tab} />
                    )
                }
            />
        </Tooltip.Provider>
    );
}
