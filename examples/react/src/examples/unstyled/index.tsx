"use client";

import {
    createModel,
    type LayoutJson,
    type RowNode,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, type RowSplitterProps } from "@fragiola/dockable-react";
import { type ReactNode, useId, useState } from "react";
import { Switch } from "#/components/ui/switch";
import { Card } from "../_kit/card";
import * as styles from "./styles";

// What the layout holds: one component, named in its data.
type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "card", data: { name: "Welcome" } },
                    { component: "card", data: { name: "Notes" } },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Inspector" } },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { component: "card", data: { name: "Output" } },
                        ],
                    },
                ],
            },
        ],
    },
};

export default function UnstyledExample() {
    // One model for both modes: switching remounts the view (a new engine for a new Root),
    // and the layout comes back exactly as you left it, because the model is the layout.
    const [model] = useState(() => createModel<Types>(json));
    const [styled, setStyled] = useState(false);
    const labelId = useId();

    /**
     * The whole recursion, with or without class names. Without them, every primitive renders a
     * plain `div` and sets only structural inline styles (flex sizing, `position`, geometry,
     * `display: none`); what you see is the browser's default rendering of that markup. The
     * children functions take the registry as a type argument (`Dockable.TabList<Types>`), so
     * `tab.data` is typed.
     */
    const renderNode = (node: TabsetNode<Types> | RowNode<Types>): ReactNode =>
        node.type === "row" ? (
            <Dockable.Row<Types> node={node} renderSplitter={renderSplitter}>
                {renderNode}
            </Dockable.Row>
        ) : (
            <TabSet node={node} styled={styled} />
        );

    /** A splitter has no name of its own: `Row` inserts it, so `renderSplitter` names it. */
    const renderSplitter = (props: RowSplitterProps<Types>) => (
        <Splitter {...props} styled={styled} />
    );

    return (
        <div className={styles.page}>
            <div className={styles.toolbar}>
                <span className={styles.switchLabel}>
                    <Switch.Root
                        aria-labelledby={labelId}
                        data-testid="styles-toggle"
                        checked={styled}
                        onCheckedChange={setStyled}
                    >
                        <Switch.Thumb />
                    </Switch.Root>
                    <span id={labelId}>Styles</span>
                </span>
                <span className={styles.caption}>
                    {styled
                        ? "Class names over the same primitives."
                        : "No CSS: only the structural inline styles the primitives set."}
                </span>
            </div>
            {/* The stage's theme sets an inherited font, colour and background. Without the
                styles, `all: initial` on this wrapper cuts that inheritance, so the layout below
                shows what the browser gives you with no CSS at all (black serif text on the
                canvas colour). It is the example's own element, not a Dockable primitive; an app
                would not need it. With the styles, it is the gutter around the layout. The key
                remounts the view when the switch flips. */}
            <div
                key={styled ? "styled" : "unstyled"}
                data-testid={styled ? undefined : "unstyled-frame"}
                className={styles.frame(styled)}
                style={
                    styled
                        ? undefined
                        : {
                              all: "initial",
                              display: "flex",
                              flex: 1,
                              minHeight: 0,
                              background: "Canvas",
                              color: "CanvasText",
                          }
                }
            >
                <Dockable.Root
                    model={model}
                    className={styles.root(styled)}
                    // Root is `position: relative`; it only needs a size to lay out in.
                    style={styled ? undefined : { flex: 1 }}
                >
                    <Dockable.Row<Types> renderSplitter={renderSplitter}>
                        {renderNode}
                    </Dockable.Row>
                    <Dockable.Panels<Types>>
                        {(tab) => (
                            <Dockable.Panel
                                node={tab}
                                className={styles.panel(styled)}
                            >
                                {styled ? (
                                    <Card name={tab.data.name} />
                                ) : (
                                    <PlainContent tab={tab} />
                                )}
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    {/* Where a dragged tab would land: drawn only with the styles. */}
                    {styled ? (
                        <Dockable.DropIndicator
                            className={styles.dropIndicator}
                            style={(state) => ({
                                transitionDuration: `${state.tabDragSpeed}s`,
                            })}
                        />
                    ) : null}
                </Dockable.Root>
            </div>
        </div>
    );
}

/** A tabset: with the styles, a card with the strip of tabs on top. */
function TabSet({
    node,
    styled,
}: {
    node: TabsetNode<Types>;
    styled: boolean;
}) {
    return (
        <Dockable.TabSet node={node} className={styles.tabset(styled)}>
            <div className={styles.strip(styled)}>
                <Dockable.TabList<Types>
                    aria-label="Tabs"
                    className={styles.tabList(styled)}
                >
                    {(tab) => (
                        <Dockable.Tab node={tab} className={styles.tab(styled)}>
                            <span className={styles.tabName(styled)}>
                                {tab.data.name}
                            </span>
                            {/* the active tabset's marker, with the styles */}
                            {styled ? (
                                <span
                                    aria-hidden="true"
                                    className={styles.tabMarker}
                                />
                            ) : null}
                        </Dockable.Tab>
                    )}
                </Dockable.TabList>
            </div>
            <Dockable.TabSetContent />
        </Dockable.TabSet>
    );
}

/** The bar between two children of a row; with the styles, a grip for the themes that show one. */
function Splitter({
    styled,
    ...props
}: RowSplitterProps<Types> & { styled: boolean }) {
    return (
        <Dockable.Splitter
            {...props}
            aria-label="Resize"
            className={styles.splitter(styled)}
        >
            {styled ? (
                <span aria-hidden="true" className={styles.splitterGrip} />
            ) : null}
        </Dockable.Splitter>
    );
}

/** Unstyled content too: a panel renders whatever you give it, styled or not. */
function PlainContent({ tab }: { tab: TabOf<Types> }) {
    const [count, setCount] = useState(0);
    return (
        <div>
            <h2>{tab.data.name}</h2>
            <button type="button" onClick={() => setCount((c) => c + 1)}>
                {`Count: ${count}`}
            </button>
        </div>
    );
}
