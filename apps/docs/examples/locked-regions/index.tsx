"use client";

import {
    type Action,
    Actions,
    DockLocation,
    type DropInfo,
    type IJsonModel,
    Model,
    type Node,
    RowNode,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { Ban, Lock } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { useStageTheme } from "../_kit/theme";

// Stop drops into part of the layout, in three layers:
//
// 1. `onAllowDrop` on `Dockable.Root` (the same rule as `model.setOnAllowDrop`): the core asks it
//    for every drop target under the pointer. Here the "Reference" tabset takes only tabs whose
//    `config.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. Over a refused target the outline hides, the browser
//    shows its "not allowed" cursor, and the target tabset and the root get `data-drop-refused`.
// 2. Model attributes: the "Console" tabset has `enableDrop: false` (nothing merges into it) and
//    `enableDivide: false` (nothing splits it), and its tabs `enableDrag: false`.
// 3. `onAction` as a safety net: an action that still tries to move a tab into the reference
//    region (from code, not from a drag) is vetoed by returning `undefined`.
//

const REFERENCE = "reference";
const CONSOLE = "console";
const LOCKED = new Set([REFERENCE, CONSOLE]);

const doc = (name: string, region: string) => ({
    type: "tab",
    name,
    component: "doc",
    config: { region },
});

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: REFERENCE,
                name: "Reference",
                weight: 30,
                children: [
                    doc("Spec", "reference"),
                    doc("Glossary", "reference"),
                ],
            },
            {
                type: "tabset",
                id: "workspace",
                name: "Workspace",
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
                name: "Console",
                weight: 25,
                enableDrop: false,
                enableDivide: false,
                children: [
                    {
                        type: "tab",
                        name: "Console",
                        component: "console",
                        enableDrag: false,
                    },
                    {
                        type: "tab",
                        name: "Output",
                        component: "console",
                        enableDrag: false,
                    },
                ],
            },
        ],
    },
};

function regionOf(node: Node | undefined) {
    return (
        (node as TabNode | undefined)?.getConfig() as
            | { region?: string }
            | undefined
    )?.region;
}

/** The drop rule. Ids are stable; paths (`/ts0`) change as the layout changes. */
function allowDrop(dragNode: Node, dropInfo: DropInfo): boolean {
    const target = dropInfo.node;
    if (target.getId() === REFERENCE) {
        return regionOf(dragNode) === REFERENCE;
    }
    // docking at the layout's edge next to a locked tabset
    if (dropInfo.kind === "edge" && target instanceof RowNode) {
        const children = target.getChildren();
        const beside =
            dropInfo.location === DockLocation.LEFT
                ? children[0]
                : dropInfo.location === DockLocation.RIGHT
                  ? children[children.length - 1]
                  : undefined;
        if (beside && LOCKED.has(beside.getId())) {
            return false;
        }
    }
    return true;
}

/** A lock on locked tabsets, with a Fragiola tooltip saying why. */
function LockBadge({ tabset }: { tabset: TabSetNode }) {
    const [themeRef, theme] = useStageTheme();
    if (!LOCKED.has(tabset.getId())) {
        return null;
    }
    const why =
        tabset.getId() === REFERENCE
            ? "Only reference tabs can be dropped here"
            : "Nothing can be dropped here, and its tabs stay put";
    return (
        <Tooltip.Root>
            <Tooltip.Trigger
                ref={themeRef}
                aria-label={`Locked: ${why}`}
                className={styles.iconButton}
            >
                <Lock aria-hidden className="size-3.5" />
            </Tooltip.Trigger>
            <Tooltip.Content data-example-theme={theme}>{why}</Tooltip.Content>
        </Tooltip.Root>
    );
}

/** The content of a document tab, with a button that tries to break the rule from code. */
function DocPanel({ tab }: { tab: TabNode }) {
    const { engine } = useDockable();
    const region = regionOf(tab);
    return (
        <PanelBody title={tab.getName()}>
            <p className="text-palette-accent/85">
                {`Region: ${region}. `}
                {region === REFERENCE
                    ? "This tab may be dropped into Reference."
                    : "Reference refuses this tab: try dragging it there."}
            </p>
            {region !== REFERENCE && tab.getParent()?.getId() !== REFERENCE ? (
                <div>
                    <button
                        type="button"
                        className={styles.button}
                        onClick={() =>
                            engine.doAction(
                                Actions.moveNode(
                                    tab.getId(),
                                    REFERENCE,
                                    DockLocation.CENTER,
                                    -1,
                                ),
                            )
                        }
                    >
                        Move to Reference from code
                    </button>
                </div>
            ) : null}
        </PanelBody>
    );
}

export default function LockedRegions() {
    const [model] = useState(() => Model.fromJson(json));
    const [notice, setNotice] = useState<string | undefined>(undefined);

    // the safety net: a move into the reference region that the drop rule did not stop
    const onAction = (action: Action) => {
        if (
            action.type === Actions.MOVE_NODE &&
            action.data.toNode === REFERENCE
        ) {
            const node = model.getNodeById(action.data.fromNode as string);
            if (regionOf(node) !== REFERENCE) {
                setNotice(
                    `onAction vetoed moving "${(node as TabNode).getName()}" into Reference.`,
                );
                return undefined;
            }
        }
        return action;
    };

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
                onAction={onAction}
                renderActions={(tabset) => <LockBadge tabset={tabset} />}
                rootProps={{ onAllowDrop: allowDrop }}
                tabsetClassName={(tabset) =>
                    // a tabset refusing the current drag is marked by data-drop-refused
                    `${LOCKED.has(tabset.getId()) ? "border-dashed" : ""} data-drop-refused:opacity-60`
                }
                renderContent={(tab) =>
                    tab.getComponent() === "doc" ? (
                        <DocPanel tab={tab} />
                    ) : (
                        <PanelBody title={tab.getName()}>
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
