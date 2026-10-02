"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Middleware,
    type RowNode,
    type TabAddPayload,
    type TabJson,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import {
    Dockable,
    type RowSplitterProps,
    useDockable,
} from "@fragiola/dockable-react";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import * as styles from "./styles";

// Stop drops into part of the layout, in two layers:
//
// 1. A middleware (`model.use`) on the commands that place a tab or tabset: `tab.move`,
//    `tabset.move` and `tab.add`. Here the "Reference" tabset takes only tabs whose
//    `data.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. It runs for every command, whoever issues it: a
//    drag asks it on every hover with `model.can` (a dry run, `ctx.dryRun`), so over a refused
//    target the outline hides, the browser shows its "not allowed" cursor, and the target
//    tabset and the root get `data-drop-refused`; a drop, or a command run from code, is vetoed
//    the same way. Each tabset styles its own `data-drop-refused`: the whole region turns red,
//    with a lock in its middle, for as long as the drag hovers it.
// 2. Node flags: the "Console" tabset has `enableDrop: false` (nothing merges into it) and
//    `enableDivide: false` (nothing splits it), and its tabs `enableDrag: false`.
//

type Types = {
    tabs: {
        doc: { region: string };
        console: undefined;
    };
    tabset: { name: string };
};

const REFERENCE = "reference";
const CONSOLE = "console";
const LOCKED = new Set([REFERENCE, CONSOLE]);

const doc = (name: string, region: string): TabJson<Types> => ({
    component: "doc",
    label: name,
    data: { region },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: REFERENCE,
                data: { name: "Reference" },
                weight: 30,
                children: [
                    doc("Spec", "reference"),
                    doc("Glossary", "reference"),
                ],
            },
            {
                type: "tabset",
                id: "workspace",
                data: { name: "Workspace" },
                weight: 45,
                children: [
                    doc("Draft", "workspace"),
                    // belongs to the reference region: it may be dropped there
                    doc("API reference", "reference"),
                    doc("Notes", "workspace"),
                ],
            },
            {
                type: "tabset",
                id: CONSOLE,
                data: { name: "Console" },
                weight: 25,
                enableDrop: false,
                enableDivide: false,
                children: [
                    {
                        component: "console",
                        label: "Console",
                        enableDrag: false,
                    },
                    {
                        component: "console",
                        label: "Output",
                        enableDrag: false,
                    },
                ],
            },
        ],
    },
};

/** A tab's region: only documents have one. */
function regionOf(tab: TabOf<Types> | TabAddPayload<Types> | undefined) {
    return tab?.component === "doc" ? tab.data.region : undefined;
}

/**
 * The drop rule, as middleware. Ids are stable; paths (`/ts0`) change as the layout changes.
 * `ctx.command` narrows `ctx.payload`.
 */
const lockedRegions: Middleware<Types> = (ctx, next) => {
    // what is placed: an existing tab (tab.move), a new tab (tab.add) or a tabset (tabset.move)
    let tab: TabOf<Types> | TabAddPayload<Types> | undefined;
    if (ctx.command === "tab.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabId });
        tab = moved?.type === "tab" ? moved : undefined;
    } else if (ctx.command === "tab.add") {
        tab = ctx.payload;
    } else if (ctx.command !== "tabset.move") {
        return next();
    }
    const { to, location } = ctx.payload;
    const name = tab ? `"${tab.label}"` : "a tabset";

    if (to === REFERENCE && regionOf(tab) !== REFERENCE) {
        return veto(`A middleware vetoed moving ${name} into Reference.`);
    }
    // docking at the layout's edge next to a locked tabset (`to` is the root row, or the layout)
    const target =
        to === MAIN_LAYOUT ? ctx.state.root : ctx.get("node-by", { id: to });
    if (target?.type === "row") {
        const children = target.children;
        const beside =
            location === "left"
                ? children[0]
                : location === "right"
                  ? children[children.length - 1]
                  : undefined;
        if (beside && LOCKED.has(beside.id)) {
            return veto(
                `A middleware vetoed docking ${name} beside a locked tabset.`,
            );
        }
    }
    return next();
};

export default function LockedRegions() {
    // the rule is installed once, with the model: it guards every command from the start
    const [model] = useState(() => {
        const created = createModel<Types>(json);
        created.use(lockedRegions);
        return created;
    });
    const [notice, setNotice] = useState<string | undefined>(undefined);

    return (
        <>
            <div className={styles.toolbar}>
                <Lock aria-hidden className={styles.toolbarIcon} />
                <p className={styles.toolbarHint}>
                    Reference takes reference tabs only; Console takes nothing.
                </p>
                <p role="status" className={styles.notice}>
                    {notice}
                </p>
            </div>
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
                                <Content tab={tab} onNotice={setNotice} />
                            </Dockable.Panel>
                        )}
                    </Dockable.Panels>
                    <Dockable.DropIndicator className={styles.dropIndicator} />
                </Dockable.Root>
            </div>
        </>
    );
}

function Content({
    tab,
    onNotice,
}: {
    tab: TabOf<Types>;
    onNotice: (notice: string | undefined) => void;
}) {
    switch (tab.component) {
        case "doc":
            return <DocPanel tab={tab} onNotice={onNotice} />;
        case "console":
            return (
                <PanelBody title={tab.label}>
                    <p className={styles.panelText}>
                        Locked in place: this tab cannot be dragged, and nothing
                        can be dropped into or beside it.
                    </p>
                </PanelBody>
            );
    }
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

/** A tabset: the strip of tabs and its lock on top, the measured content area below. */
function TabSet({ node }: { node: TabsetNode<Types> }) {
    return (
        <Dockable.TabSet
            node={node}
            className={styles.tabset(LOCKED.has(node.id))}
        >
            <div className={styles.strip}>
                <Dockable.TabList<Types>
                    // a tabset created by a drop has no name of its own
                    aria-label={node.data?.name || "Tabs"}
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
                <div className={styles.tabsetActions}>
                    <LockBadge tabset={node} />
                </div>
            </div>
            <Dockable.TabSetContent />
            {/* over the whole tabset (its strip and its panel) while it refuses the drag */}
            <div
                aria-hidden="true"
                data-testid="refused-overlay"
                className={styles.refusedOverlay}
            >
                <span className={styles.refusedBadge}>
                    <Lock className={styles.refusedIcon} />
                </span>
                <span className={styles.refusedText}>Not allowed here</span>
            </div>
        </Dockable.TabSet>
    );
}

/** A lock on locked tabsets, with a Fragiola tooltip saying why. */
function LockBadge({ tabset }: { tabset: TabsetNode<Types> }) {
    if (!LOCKED.has(tabset.id)) {
        return null;
    }
    const why =
        tabset.id === REFERENCE
            ? "Only reference tabs can be dropped here"
            : "Nothing can be dropped here, and its tabs stay put";
    return (
        <Tooltip.Root>
            <Tooltip.Trigger
                aria-label={`Locked: ${why}`}
                className={styles.lockBadge}
            >
                <Lock aria-hidden className={styles.lockIcon} />
            </Tooltip.Trigger>
            <Tooltip.Content>{why}</Tooltip.Content>
        </Tooltip.Root>
    );
}

/** The content of a document tab, with a button that tries to break the rule from code. */
function DocPanel({
    tab,
    onNotice,
}: {
    tab: Extract<TabOf<Types>, { component: "doc" }>;
    onNotice: (notice: string | undefined) => void;
}) {
    const { model } = useDockable<Types>();
    const region = tab.data.region;
    // a command from code goes through the same middleware: the result says why it was refused
    const moveToReference = () => {
        const result = model.run("tab.move", {
            tabId: tab.id,
            to: REFERENCE,
            location: "center",
            index: -1,
        });
        onNotice(result.ok ? undefined : result.error.message);
    };
    return (
        <PanelBody title={tab.label}>
            <p className={styles.panelText}>
                {`Region: ${region}. `}
                {region === REFERENCE
                    ? "This tab may be dropped into Reference."
                    : "Reference refuses this tab: try dragging it there."}
            </p>
            {region !== REFERENCE &&
            model.get("node-parent-by", { nodeId: tab.id })?.id !==
                REFERENCE ? (
                <div>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={moveToReference}
                    >
                        Move to Reference from code
                    </button>
                </div>
            ) : null}
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
