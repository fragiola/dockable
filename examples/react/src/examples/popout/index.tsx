"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { ArrowDownToLine, SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// Pop a tab out into its own browser window, and back. The core opens the window (`popoutURL`,
// served under the site's base path), copies the page's styles into it and moves the tab's
// content element there: the counter and the notes keep their state both ways. Closing the window
// docks its tabs back into the main layout (the default "dock" policy). A tab can also be dragged
// from the window into the main layout, and back (see the popout-drag example).

type Types = { tabs: { card: undefined } };

const json: LayoutJson<Types> = {
    version: 1,
    // tabs may be popped out (off by default)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", label: "Editor" },
                    { component: "card", label: "Preview" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "card", label: "Chat" },
                    {
                        component: "card",
                        label: "Pinned here",
                        // this one stays in the main window
                        enablePopout: false,
                    },
                ],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function Popout() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        // The root needs a size: the wrapper gives it one, and the gutter around it.
        <div className={styles.frame}>
            <Dockable.Root
                model={model}
                popoutURL={popoutURL}
                // copies <html> and <body>'s attributes (light/dark, the example theme) into each
                // popout window, kept in sync
                popoutMirrorRoot
                className={styles.root}
            >
                {/* The layout's rows and tabsets: the developer owns the recursion. */}
                <Dockable.Row<Types>
                    renderSplitter={(props) => <Splitter {...props} />}
                >
                    {renderNode}
                </Dockable.Row>
                {/* Every tab's content, in this window or a popout, positioned by the engine. */}
                <Dockable.Panels<Types>>
                    {(tab) => (
                        <Dockable.Panel node={tab} className={styles.panel}>
                            <Card name={tab.label}>
                                <p className={styles.panelText}>
                                    Count, type a note, then pop the tab out
                                    with the button in its header. Dock it back
                                    from the window, or close the window.
                                </p>
                            </Card>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <Dockable.DropIndicator className={styles.dropIndicator} />
                {/* Each popout window: its own floor, rows and drop outline, portalled into the
                    window once it is ready. */}
                <Dockable.Popout<Types> className={styles.popout}>
                    {() => (
                        <>
                            <Dockable.Row<Types>
                                renderSplitter={(props) => (
                                    <Splitter {...props} />
                                )}
                            >
                                {renderNode}
                            </Dockable.Row>
                            {/* a window shows its own outline during a drag into it */}
                            <Dockable.DropIndicator
                                className={styles.dropIndicator}
                            />
                        </>
                    )}
                </Dockable.Popout>
            </Dockable.Root>
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

/**
 * A tabset: a card with the strip of tabs and its buttons on top, and the measured content area
 * below.
 */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset}>
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab}>
                            <span className={styles.tabName}>{tab.label}</span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.tabsetButtons}>
                    <PopoutButton tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/**
 * `Dockable.PopoutTrigger` pops the selected tab out and, in a popout, docks it back into the main
 * layout's active tabset. It renders nothing when the tab cannot pop out (here "Pinned here"), and
 * says which way it goes with `data-mode` ("popout" or "dock"): the icons follow it.
 */
function PopoutButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.get("selected-tab-by", {
        tabsetId: tabset.id,
    });
    const inWindow = model.is("node-in-window", { nodeId: tabset.id });
    const name = selected?.label ?? "";
    return (
        <Dockable.PopoutTrigger
            aria-label={inWindow ? `Dock ${name} back` : `Pop out ${name}`}
            className={styles.popoutButton}
        >
            <SquareArrowOutUpRight aria-hidden className={styles.popoutIcon} />
            <ArrowDownToLine aria-hidden className={styles.dockIcon} />
        </Dockable.PopoutTrigger>
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
