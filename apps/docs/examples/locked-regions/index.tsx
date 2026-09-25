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
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import { useStageTheme } from "../_kit/stage-theme";
import * as styles from "../_kit/styles";

// Stop drops into part of the layout, in three layers:
//
// 1. `model.setOnAllowDrop(fn)`: the core asks it for every drop target under the pointer. Here
//    the "Reference" tabset takes only tabs whose `config.region` is "reference" (in its strip,
//    its centre or its sides), and the layout's edge beside a locked tabset refuses docking. A
//    refused target gets no drop indicator, and the browser shows its "not allowed" cursor.
// 2. Model attributes: the "Console" tabset has `enableDrop: false` (nothing merges into it) and
//    `enableDivide: false` (nothing splits it), and its tabs `enableDrag: false`.
// 3. `onAction` as a safety net: an action that still tries to move a tab into the reference
//    region (from code, not from a drag) is vetoed by returning `undefined`.
//
// Custom drop zones and richer feedback for refused drops come with the Drop control Epic:
// https://github.com/fragiola/dockable/issues/19

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

/**
 * The core keeps showing the last accepted target's indicator while the pointer is over a refused
 * one (it just stops accepting the drop). This listens after the engine (on the document, where
 * the event arrives after the root's own listener) and reports whether the last `dragover` was
 * refused, so the example can hide the indicator. Workaround for a gap: see the gap report.
 */
function useRefusedDrag(onChange: (refused: boolean) => void) {
    const { engine } = useDockable();
    useEffect(() => {
        const root = engine.getLayoutRef();
        const doc = root?.ownerDocument;
        if (!root || !doc) {
            return;
        }
        const onDragOver = (event: DragEvent) => {
            if (root.contains(event.target as globalThis.Node)) {
                // the engine calls preventDefault on a dragover it accepts
                onChange(!event.defaultPrevented);
            }
        };
        const reset = () => onChange(false);
        doc.addEventListener("dragover", onDragOver);
        doc.addEventListener("drop", reset);
        doc.addEventListener("dragend", reset);
        return () => {
            doc.removeEventListener("dragover", onDragOver);
            doc.removeEventListener("drop", reset);
            doc.removeEventListener("dragend", reset);
        };
    }, [engine, onChange]);
}

function RefusedDragWatcher({
    onChange,
}: {
    onChange: (refused: boolean) => void;
}) {
    useRefusedDrag(onChange);
    return null;
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
    const [model] = useState(() => {
        const created = Model.fromJson(json);
        created.setOnAllowDrop(allowDrop);
        return created;
    });
    const [refused, setRefused] = useState(false);
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
                tabsetClassName={(tabset) =>
                    LOCKED.has(tabset.getId()) ? "border-dashed" : ""
                }
                // hide the stale indicator over a refused target (see useRefusedDrag)
                className={cn(refused && "[&_[data-drop-kind]]:invisible")}
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
                <RefusedDragWatcher onChange={setRefused} />
            </DockLayout>
        </>
    );
}
