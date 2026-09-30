"use client";

import {
    createModel,
    type DragSubject,
    type LayoutJson,
    type Model,
    type TabOf,
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
// layout hides its outline). A drop calls `onDrop` with what is dragged: nothing moves by itself,
// the zone runs the command it stands for on the model (so its middleware sees it).

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Inbox" } },
                    { component: "card", data: { name: "Drafts" } },
                    // cannot be closed: the trash does not take it
                    {
                        component: "card",
                        data: { name: "Pinned note" },
                        enableClose: false,
                    },
                ],
            },
            {
                type: "tabset",
                weight: 50,
                children: [
                    { component: "card", data: { name: "Calendar" } },
                    { component: "card", data: { name: "Contacts" } },
                ],
            },
        ],
    },
};

/** The dragged tab of the layout, or undefined for a tabset or a new tab. */
function draggedTab(drag: DragSubject<Types>): TabOf<Types> | undefined {
    return drag.kind === "tab" ? drag.tab : undefined;
}

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
    model: Model<Types>;
    icon: LucideIcon;
    label: ReactNode;
    accepts: (tab: TabOf<Types>) => boolean;
    onDrop: (tab: TabOf<Types>) => void;
    tone: string;
}) {
    return (
        <Dockable.DropZone
            model={model}
            // the zones take tabs only
            accepts={(drag) => {
                const tab = draggedTab(drag);
                return tab !== undefined && accepts(tab);
            }}
            onDrop={(drag) => {
                const tab = draggedTab(drag);
                if (tab) onDrop(tab);
            }}
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
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("Drag a tab onto a zone below.");

    // the zones live outside Dockable.Root: they run commands on the model itself
    const report = (ok: boolean, describe: string) => {
        if (ok) setStatus(describe);
    };

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
                    accepts={(tab) =>
                        model.can("tab.close", { tab: tab.id }).ok
                    }
                    onDrop={(tab) =>
                        report(
                            model.run("tab.close", { tab: tab.id }).ok,
                            `Closed ${tab.data.name}`,
                        )
                    }
                />
                <Zone
                    model={model}
                    id="right"
                    icon={PanelRight}
                    label="Open to the right"
                    tone="palette-blue"
                    accepts={() => true}
                    onDrop={(tab) => {
                        const root = model.root();
                        if (!root) return;
                        // the right edge of the root row: a new tabset on the right of the layout
                        report(
                            model.run("tab.move", {
                                tab: tab.id,
                                to: root.id,
                                location: "right",
                            }).ok,
                            `Moved ${tab.data.name} to the right`,
                        );
                    }}
                />
                <Zone
                    model={model}
                    id="popout"
                    icon={ExternalLink}
                    label="Pop out"
                    tone="palette-green"
                    accepts={(tab) =>
                        model.can("tab.popout", { tab: tab.id }).ok
                    }
                    onDrop={(tab) =>
                        report(
                            model.run("tab.popout", { tab: tab.id }).ok,
                            `Popped out ${tab.data.name}`,
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
