"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type Middleware,
    type TabAddPayload,
    type TabJson,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Ban, Lock } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "#/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Stop drops into part of the layout, in two layers:
//
// 1. A middleware (`model.use`) on the commands that place a tab or tabset: `tab.move`,
//    `tabset.move` and `tab.add`. Here the "Reference" tabset takes only tabs whose
//    `data.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. It runs for every command, whoever issues it: a
//    drag asks it on every hover with `model.can` (a dry run, `ctx.dryRun`), so over a refused
//    target the outline hides, the browser shows its "not allowed" cursor, and the target
//    tabset and the root get `data-drop-refused`; a drop, or a command run from code, is vetoed
//    the same way.
// 2. Node flags: the "Console" tabset has `enableDrop: false` (nothing merges into it) and
//    `enableDivide: false` (nothing splits it), and its tabs `enableDrag: false`.
//

type Types = {
    tabs: {
        doc: { name: string; region: string };
        console: { name: string };
    };
    tabset: { name: string };
};

const REFERENCE = "reference";
const CONSOLE = "console";
const LOCKED = new Set([REFERENCE, CONSOLE]);

const doc = (name: string, region: string): TabJson<Types> => ({
    component: "doc",
    data: { name, region },
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
                        data: { name: "Console" },
                        enableDrag: false,
                    },
                    {
                        component: "console",
                        data: { name: "Output" },
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
 * `ctx.payload` is the payload of `ctx.command`: the fields it names tell which one it is.
 */
const lockedRegions: Middleware<Types> = (ctx, next) => {
    if (
        ctx.command !== "tab.move" &&
        ctx.command !== "tabset.move" &&
        ctx.command !== "tab.add"
    ) {
        return next();
    }
    const payload = ctx.payload;
    if (!("to" in payload)) {
        return next();
    }
    // what is placed: an existing tab (tab.move), a new tab (tab.add) or a tabset (tabset.move)
    const moving =
        "tab" in payload
            ? ctx.get(payload.tab)
            : "component" in payload
              ? payload
              : undefined;
    const tab = moving && "component" in moving ? moving : undefined;
    const name = tab ? `"${tab.data.name}"` : "a tabset";

    if (payload.to === REFERENCE && regionOf(tab) !== REFERENCE) {
        return veto(`A middleware vetoed moving ${name} into Reference.`);
    }
    // docking at the layout's edge next to a locked tabset (`to` is the root row, or the layout)
    const target =
        payload.to === MAIN_LAYOUT ? ctx.state.root : ctx.get(payload.to);
    if (target?.type === "row") {
        const children = target.children;
        const beside =
            payload.location === "left"
                ? children[0]
                : payload.location === "right"
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
                className={styles.iconButton}
            >
                <Lock aria-hidden className="size-3.5" />
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
    const { model, run } = useDockable<Types>();
    const region = tab.data.region;
    // a command from code goes through the same middleware: the result says why it was refused
    const moveToReference = () => {
        const result = run("tab.move", {
            tab: tab.id,
            to: REFERENCE,
            location: "center",
            index: -1,
        });
        onNotice(result.ok ? undefined : result.error.message);
    };
    return (
        <PanelBody title={tab.data.name}>
            <p className="text-palette-accent/85">
                {`Region: ${region}. `}
                {region === REFERENCE
                    ? "This tab may be dropped into Reference."
                    : "Reference refuses this tab: try dragging it there."}
            </p>
            {region !== REFERENCE &&
            model.parentOf(tab.id)?.id !== REFERENCE ? (
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
                <Lock aria-hidden className="size-4 text-palette-accent/85" />
                <p className="text-sm text-palette-accent/85">
                    Reference takes reference tabs only; Console takes nothing.
                </p>
                <p role="status" className="ms-auto text-sm">
                    {notice}
                </p>
            </div>
            <DockLayout
                model={model}
                renderActions={(tabset) => <LockBadge tabset={tabset} />}
                tabsetClassName={(tabset) =>
                    // a tabset refusing the current drag is marked by data-drop-refused
                    `${LOCKED.has(tabset.id) ? "border-dashed" : ""} data-drop-refused:opacity-60`
                }
                renderContent={(tab) =>
                    tab.component === "doc" ? (
                        <DocPanel tab={tab} onNotice={setNotice} />
                    ) : (
                        <PanelBody title={tab.data.name}>
                            <p className="text-palette-accent/85">
                                Locked in place: this tab cannot be dragged, and
                                nothing can be dropped into or beside it.
                            </p>
                        </PanelBody>
                    )
                }
            >
                {/* inside the root: shown while the root has data-drop-refused */}
                <div
                    role="status"
                    className="palette-danger pointer-events-none absolute start-1/2 top-3 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-full bg-palette-base px-3 py-1.5 text-sm text-palette-contrast shadow-md in-data-drop-refused:flex rtl:translate-x-1/2"
                >
                    <Ban aria-hidden className="size-4" />
                    Not allowed here
                </div>
            </DockLayout>
        </>
    );
}
