"use client";

import { createModel, type LayoutJson, type Model } from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { DockLayout } from "../_kit/layout";
import {
    iconOf,
    type Types,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetTab,
} from "./widgets";

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    { component: "revenue", data: { name: "Revenue chart" } },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { component: "orders", data: { name: "Orders table" } },
                ],
            },
        ],
    },
};

/** A widget in the sidebar: drag it into the layout, or click it (keyboard: Enter) to add it. */
function WidgetSource({
    model,
    widget,
    onAdded,
}: {
    model: Model<Types>;
    widget: Widget;
    onAdded: (tab: string | undefined) => void;
}) {
    const Icon = widget.icon;

    // Native drag and drop has no keyboard path, so a click adds the widget to the active
    // tabset. `tab.add` runs on the model, through its middleware, like the drop does.
    const addToActiveTabset = () => {
        const target = model.activeTabset() ?? model.tabsets()[0];
        if (!target) return;
        const added = model.run("tab.add", {
            ...widgetTab(widget),
            to: target.id,
            select: true,
        });
        onAdded(added.ok ? added.value.tab : undefined);
    };

    return (
        <Dockable.DragSource
            model={model}
            tab={() => widgetTab(widget)}
            onDrop={(tab) => onAdded(tab)}
            render={<button type="button" onClick={addToActiveTabset} />}
            aria-description="Drag into the layout, or press to add to the active tabset"
            className={[
                "palette-raised flex w-full cursor-grab items-center gap-3 rounded-(--dk-radius) border border-palette-line",
                "bg-palette-base p-2.5 text-start text-sm text-palette-contrast outline-none",
                "hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring",
                "active:cursor-grabbing data-dragging:opacity-50",
            ].join(" ")}
        >
            <span className="palette-blue grid size-8 shrink-0 place-items-center rounded-md bg-palette-soft text-palette-accent">
                <Icon aria-hidden className="size-4" />
            </span>
            <span className="min-w-0">
                <span className="block truncate font-medium">
                    {widget.title}
                </span>
                <span className="block truncate text-xs text-palette-accent/85">
                    {widget.description}
                </span>
            </span>
        </Dockable.DragSource>
    );
}

export default function WidgetSidebar() {
    const [model] = useState(() => createModel<Types>(json));
    const [status, setStatus] = useState("");
    // the new tab's id, or undefined when the add was refused
    const onAdded = (id: string | undefined) => {
        const tab = id === undefined ? undefined : model.get(id);
        setStatus(
            tab?.type === "tab" ? `Added ${tab.data.name}` : "Nothing added",
        );
    };

    return (
        <div className="flex min-h-0 flex-1">
            <aside
                aria-label="Widgets"
                className="palette-surface flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-e border-palette-line bg-palette-base p-3"
            >
                <h2 className="text-xs font-semibold tracking-wide text-palette-accent/85 uppercase">
                    Widgets
                </h2>
                <ul className="flex flex-col gap-2">
                    {WIDGETS.map((widget) => (
                        <li key={widget.component}>
                            <WidgetSource
                                model={model}
                                widget={widget}
                                onAdded={onAdded}
                            />
                        </li>
                    ))}
                </ul>
                <p
                    role="status"
                    data-testid="status"
                    className="mt-auto text-xs text-palette-accent/85"
                >
                    {status}
                </p>
            </aside>
            <DockLayout
                model={model}
                renderContent={(tab) => <WidgetContent tab={tab} />}
                renderTab={(tab) => {
                    const Icon = iconOf(tab);
                    return (
                        <>
                            {Icon ? (
                                <Icon
                                    aria-hidden
                                    className="size-3.5 shrink-0"
                                />
                            ) : null}
                            <span data-tab-label className="truncate">
                                {tab.data.name}
                            </span>
                        </>
                    );
                }}
                // while a drag is over the layout the root has data-dragging: outline every
                // tabset so the drop targets are obvious
                tabsetClassName="in-data-dragging:outline-2 in-data-dragging:outline-dashed in-data-dragging:outline-palette-line"
            />
        </div>
    );
}
