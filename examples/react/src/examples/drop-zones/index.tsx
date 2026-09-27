"use client";

import {
    Actions,
    DockLocation,
    type IJsonModel,
    LayoutEngine,
    Model,
    type Node,
    TabNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import {
    ExternalLink,
    type LucideIcon,
    PanelRight,
    Trash2,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";

// Drop zones: elements outside the layout that take a dragged tab. While a drag the zone takes is
// in progress it has `data-drop-active`; while the pointer is over it, `data-drop-over` (and the
// layout hides its outline). A drop calls `onDrop` with the dragged node: nothing moves by itself,
// the zone dispatches the action it stands for, through the engine (so `onAction` sees it).

const json: IJsonModel = {
    global: { tabEnablePopout: true },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Inbox", component: "card" },
                    { type: "tab", name: "Drafts", component: "card" },
                    // cannot be closed: the trash does not take it
                    {
                        type: "tab",
                        name: "Pinned note",
                        component: "card",
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Calendar", component: "card" },
                    { type: "tab", name: "Contacts", component: "card" },
                ],
            },
        ],
    },
};

function Zone({
    model,
    icon: Icon,
    label,
    accepts,
    onDrop,
    tone,
    id,
}: {
    id: string;
    model: Model;
    icon: LucideIcon;
    label: ReactNode;
    accepts: (node: Node) => boolean;
    onDrop: (node: Node) => void;
    tone: string;
}) {
    return (
        <Dockable.DropZone
            model={model}
            accepts={accepts}
            onDrop={(node) => onDrop(node)}
            data-testid={`zone-${id}`}
            className={[
                tone,
                "flex flex-1 items-center justify-center gap-2 rounded-(--dk-radius) border-2 border-dashed border-palette-line p-3 text-sm",
                "text-palette-accent/85 transition-[opacity,background-color] duration-(--dk-motion)",
                // idle: faded; a drag it would take: armed; the pointer over it: filled
                "opacity-50 data-drop-active:border-palette-base data-drop-active:opacity-100",
                "data-drop-over:border-solid data-drop-over:bg-palette-base data-drop-over:text-palette-contrast",
            ].join(" ")}
        >
            <Icon aria-hidden className="size-4" />
            {label}
        </Dockable.DropZone>
    );
}

export default function DropZones() {
    const [model] = useState(() => Model.fromJson(json));
    const [status, setStatus] = useState("Drag a tab onto a zone below.");

    // the zones live outside Dockable.Root: LayoutEngine.of finds the mounted layout's engine
    const act = (
        describe: string,
        action: Parameters<LayoutEngine["doAction"]>[0],
    ) => {
        LayoutEngine.of(model)?.doAction(action);
        setStatus(describe);
    };
    const isTab = (node: Node): node is TabNode => node instanceof TabNode;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <DockLayout
                model={model}
                renderContent={(tab) => <Card tab={tab} />}
            />
            <div className="palette-surface flex flex-wrap items-stretch gap-2 border-t border-palette-line bg-palette-base p-2">
                <Zone
                    model={model}
                    id="close"
                    icon={Trash2}
                    label="Close"
                    tone="palette-danger"
                    // only tabs that may be closed
                    accepts={(node) => isTab(node) && node.isEnableClose()}
                    onDrop={(node) =>
                        act(
                            `Closed ${(node as TabNode).getName()}`,
                            Actions.deleteTab(node.getId()),
                        )
                    }
                />
                <Zone
                    model={model}
                    id="right"
                    icon={PanelRight}
                    label="Open to the right"
                    tone="palette-blue"
                    accepts={isTab}
                    onDrop={(node) => {
                        const root = model.getRootRow();
                        if (!root) return;
                        act(
                            `Moved ${(node as TabNode).getName()} to the right`,
                            Actions.moveNode(
                                node.getId(),
                                root.getId(),
                                DockLocation.RIGHT,
                                -1,
                            ),
                        );
                    }}
                />
                <Zone
                    model={model}
                    id="popout"
                    icon={ExternalLink}
                    label="Pop out"
                    tone="palette-green"
                    accepts={(node) => isTab(node) && node.isEnablePopout()}
                    onDrop={(node) =>
                        act(
                            `Popped out ${(node as TabNode).getName()}`,
                            Actions.popoutTab(node.getId(), "window"),
                        )
                    }
                />
                <p
                    role="status"
                    data-testid="status"
                    className="basis-full text-center text-xs text-palette-accent/85"
                >
                    {status}
                </p>
            </div>
        </div>
    );
}
