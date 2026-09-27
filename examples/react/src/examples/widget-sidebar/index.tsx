"use client";

import {
    Actions,
    DockLocation,
    type IJsonModel,
    LayoutEngine,
    Model,
    type TabNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { DockLayout } from "../_kit/layout";
import {
    iconOf,
    WIDGETS,
    type Widget,
    WidgetContent,
    widgetTab,
} from "./widgets";

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 60,
                children: [
                    {
                        type: "tab",
                        name: "Revenue chart",
                        component: "revenue",
                    },
                ],
            },
            {
                type: "tabset",
                weight: 40,
                children: [
                    { type: "tab", name: "Orders table", component: "orders" },
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
    model: Model;
    widget: Widget;
    onAdded: (tab: TabNode | undefined) => void;
}) {
    const Icon = widget.icon;

    // Native drag and drop has no keyboard path, so a click adds the widget to the active
    // tabset. LayoutEngine.of(model) finds the engine of the mounted layout: dispatching through
    // it (not model.doAction) keeps onAction in the loop.
    const addToActiveTabset = () => {
        const engine = LayoutEngine.of(model);
        const target = model.getActiveTabset() ?? model.getFirstTabSet();
        if (!engine || !target) return;
        const added = engine.doAction(
            Actions.addTab(
                widgetTab(widget),
                target.getId(),
                DockLocation.CENTER,
                -1,
                true,
            ),
        );
        onAdded(added as TabNode | undefined);
    };

    return (
        <Dockable.DragSource
            model={model}
            json={() => widgetTab(widget)}
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
    const [model] = useState(() => Model.fromJson(json));
    const [status, setStatus] = useState("");
    const onAdded = (tab: TabNode | undefined) =>
        setStatus(tab ? `Added ${tab.getName()}` : "Nothing added");

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
                                {tab.getName()}
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
