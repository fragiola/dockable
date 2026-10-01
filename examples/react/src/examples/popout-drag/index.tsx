"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import {
    AppWindow,
    ArrowDownToLine,
    SquareArrowOutUpRight,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// Tabs move between windows like between tabsets: pop one out, then drag tabs into the window or
// out of it. The page's windows share one drag state, so a drag that starts in one window drops in
// another; each window draws its own outline (a DropIndicator inside Dockable.Popout, below).
// The content element moves with the tab, so the counter and the notes keep their values.

// What the layout holds: one tab component, named in its data.
type Types = { tabs: { card: { name: string } } };

const card = (name: string) => ({ component: "card" as const, data: { name } });

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [card("Orders"), card("Customers"), card("Invoices")],
            },
            {
                type: "tabset",
                weight: 50,
                children: [card("Chart"), card("Notes")],
            },
        ],
    },
};

// The popout host page, served next to the app under its base (Vite's `BASE_URL`).
const popoutURL = `${import.meta.env.BASE_URL}popout.html`;

export default function PopoutDrag() {
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
                            <Card name={tab.data.name}>
                                <p className={styles.panelHint}>
                                    Pop this tab out, then drag tabs into its
                                    window, and back into this one.
                                </p>
                            </Card>
                        </Dockable.Panel>
                    )}
                </Dockable.Panels>
                <DropIndicator />
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
                            <DropIndicator />
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
                            <span className={styles.tabName}>
                                {tab.data.name}
                            </span>
                            {/* the active tabset's marker */}
                            <span
                                aria-hidden="true"
                                className={styles.tabMarker}
                            />
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
                <div className={styles.tabsetActions}>
                    <WindowButtons tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** Two triggers: the selected tab, and the whole tabset. Each docks back from a window. */
function WindowButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    return (
        <>
            <Dockable.PopoutTrigger
                aria-label="Pop out the tab"
                data-testid="popout-tab"
                className={styles.windowButton}
            >
                <SquareArrowOutUpRight
                    aria-hidden
                    className={styles.popoutIcon}
                />
                <ArrowDownToLine aria-hidden className={styles.dockIcon} />
            </Dockable.PopoutTrigger>
            {/* one trigger per tabset is enough in a window: the tab trigger docks back */}
            {tabset.children.length > 1 ? (
                <Dockable.PopoutTrigger
                    target="tabset"
                    aria-label="Pop out the whole tabset"
                    data-testid="popout-tabset"
                    className={styles.tabsetWindowButton}
                >
                    <AppWindow aria-hidden className={styles.tabsetIcon} />
                </Dockable.PopoutTrigger>
            ) : null}
        </>
    );
}

/** Where a dragged tab would land. */
function DropIndicator() {
    return (
        <Dockable.DropIndicator
            className={styles.dropIndicator}
            style={(state) => ({
                transitionDuration: `${state.tabDragSpeed}s`,
            })}
        />
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
