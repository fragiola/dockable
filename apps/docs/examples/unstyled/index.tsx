"use client";

import {
    type IJsonModel,
    Model,
    RowNode,
    type TabNode,
    TabSetNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { type ReactNode, useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card } from "../_kit/card";
import { getLabel } from "../_kit/labels";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { type: "tab", name: "Welcome", component: "card" },
                    { type: "tab", name: "Notes", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            {
                                type: "tab",
                                name: "Inspector",
                                component: "card",
                            },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Output", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

/**
 * The whole recursion with no class names at all. Every primitive renders a plain `div` and
 * sets only structural inline styles (flex sizing, `position`, geometry, `display: none`);
 * what you see is the browser's default rendering of that markup.
 */
function renderNode(child: TabSetNode | RowNode): ReactNode {
    if (child instanceof TabSetNode) {
        return (
            <Dockable.TabSet node={child}>
                <Dockable.TabList aria-label={child.getName() ?? "Tabs"}>
                    {(tab) => (
                        <Dockable.Tab node={tab}>{tab.getName()}</Dockable.Tab>
                    )}
                </Dockable.TabList>
                <Dockable.TabSetContent />
            </Dockable.TabSet>
        );
    }
    if (child instanceof RowNode) {
        return <Dockable.Row node={child}>{renderNode}</Dockable.Row>;
    }
    return null;
}

/** Unstyled content too: a panel renders whatever you give it, styled or not. */
function PlainContent({ tab }: { tab: TabNode }) {
    const [count, setCount] = useState(0);
    return (
        <div>
            <h2>{tab.getName()}</h2>
            <button type="button" onClick={() => setCount((c) => c + 1)}>
                {`Count: ${count}`}
            </button>
        </div>
    );
}

function Unstyled({ model }: { model: Model }) {
    return (
        // The stage's theme sets an inherited font, colour and background. `all: initial`
        // on this wrapper cuts that inheritance, so the layout below shows what the browser
        // gives you with no CSS at all (black serif text on the canvas colour). It is the
        // example's own element, not a Dockable primitive; an app would not need it.
        // The ide, paper and terminal themes still reach a few elements: their stylesheets
        // style `[role="tab"]`, `[role="tablist"]` and `[data-active]` directly, which is the
        // other way to style the package (plain CSS on its ARIA and data-* attributes).
        <div
            data-testid="unstyled-frame"
            style={{
                all: "initial",
                display: "flex",
                flex: 1,
                minHeight: 0,
                background: "Canvas",
                color: "CanvasText",
            }}
        >
            <Dockable.Root
                model={model}
                getLabel={getLabel}
                // Root is `position: relative`; it only needs a size to lay out in.
                style={{ flex: 1 }}
            >
                <Dockable.Row>{renderNode}</Dockable.Row>
                <Dockable.Panels>
                    {(tab) => (
                        <Dockable.Panel node={tab}>
                            <PlainContent tab={tab} />
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
            </Dockable.Root>
        </div>
    );
}

export default function UnstyledExample() {
    // One model for both modes: switching remounts the view (a new engine for a new Root),
    // and the layout comes back exactly as you left it, because the model is the layout.
    const [model] = useState(() => Model.fromJson(json));
    const [kit, setKit] = useState(false);
    const labelId = useId();
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                <span className="flex items-center gap-2 text-sm">
                    <Switch.Root
                        aria-labelledby={labelId}
                        data-testid="kit-toggle"
                        checked={kit}
                        onCheckedChange={setKit}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={labelId}>Kit styles</span>
                </span>
                <span className="text-sm text-palette-accent/85">
                    {kit
                        ? "The example kit's class names over the same primitives."
                        : "No CSS: only the structural inline styles the primitives set."}
                </span>
            </div>
            {kit ? (
                <DockLayout
                    model={model}
                    renderContent={(tab) => <Card tab={tab} />}
                />
            ) : (
                <Unstyled model={model} />
            )}
        </div>
    );
}
