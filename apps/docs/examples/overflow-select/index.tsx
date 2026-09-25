"use client";

import {
    Actions,
    type IJsonModel,
    Model,
    type TabSetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { Card } from "../_kit/card";
import { DockLayout, KitTab } from "../_kit/layout";
import { useStageTheme } from "../_kit/stage-theme";
import * as styles from "../_kit/styles";

// When the tabs do not fit, the strip is replaced by a Fragiola Select listing them. The package
// has no overflow UI: the consumer measures and decides.
//
// The tab list stays mounted and in the flow (only hidden), so its width is always "the space
// available" and its scrollWidth is always "what the tabs need". Swapping in the select never
// changes either, so there is no flicker loop to guard against.

const file = (name: string) => ({ type: "tab", name, component: "file" });

const json: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 65,
                children: [
                    file("main.ts"),
                    file("App.tsx"),
                    file("layout.tsx"),
                    file("styles.css"),
                    file("api.ts"),
                    file("README.md"),
                ],
            },
            {
                type: "tabset",
                weight: 35,
                children: [file("Terminal"), file("Problems")],
            },
        ],
    },
};

/** True when the element's content is wider than the element, re-checked as it resizes. */
function useOverflow(ref: React.RefObject<HTMLElement | null>) {
    const [overflow, setOverflow] = useState(false);
    // tabs added, closed or renamed change the content width without resizing the list, so
    // re-check after every render as well as on resize
    useLayoutEffect(() => {
        const element = ref.current;
        if (element) {
            setOverflow(element.scrollWidth > element.clientWidth + 1);
        }
    });
    useEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const observer = new ResizeObserver(() =>
            setOverflow(element.scrollWidth > element.clientWidth + 1),
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return overflow;
}

function OverflowStrip({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const listRef = useRef<HTMLElement | null>(null);
    const overflow = useOverflow(listRef);
    const [themeRef, theme] = useStageTheme();
    const tabs = tabset.getTabNodes();
    // `items` lets Select.Value show the selected tab's name instead of its id
    const items = Object.fromEntries(
        tabs.map((tab) => [tab.getId(), tab.getName()]),
    );

    return (
        <div
            data-overflow={overflow ? "" : undefined}
            className={cn(styles.tabsetHeader, "relative")}
        >
            <Dockable.TabList
                ref={listRef}
                aria-label={tabset.getName() ?? "Tabs"}
                data-kit-tablist=""
                // hidden, not unmounted: it keeps its measurements and the engine's strip
                className={cn(styles.tabList, overflow && "invisible")}
            >
                {(tab) => <KitTab node={tab} />}
            </Dockable.TabList>
            {overflow ? (
                <Select.Root
                    items={items}
                    value={tabset.getSelectedNode()?.getId() ?? null}
                    onValueChange={(id) => {
                        if (typeof id === "string") {
                            engine.doAction(Actions.selectTab(id));
                        }
                    }}
                >
                    <Select.Trigger
                        ref={themeRef}
                        aria-label="Open tab"
                        className="absolute inset-y-1 start-1 h-auto w-56 max-w-[calc(100%-0.5rem)] py-0"
                    >
                        <Select.Value className="truncate text-palette-contrast" />
                    </Select.Trigger>
                    <Select.Content data-example-theme={theme}>
                        {tabs.map((tab) => (
                            <Select.Item key={tab.getId()} value={tab.getId()}>
                                {items[tab.getId()]}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select.Root>
            ) : null}
        </div>
    );
}

export default function OverflowSelect() {
    const [model] = useState(() => Model.fromJson(json));
    return (
        <DockLayout
            model={model}
            renderHeader={(tabset) => <OverflowStrip tabset={tabset} />}
            renderContent={(tab) => <Card tab={tab} />}
        />
    );
}
