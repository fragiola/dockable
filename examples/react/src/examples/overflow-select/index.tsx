"use client";

import {
    Actions,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import {
    Dockable,
    useDockable,
    useTabOverflow,
} from "@fragiola/dockable-react";
import { useState } from "react";
import { Select } from "#/components/ui/select";
import { Card } from "../_kit/card";
import { DockLayout, KitTab } from "../_kit/layout";
import * as styles from "../_kit/styles";
import { useStageTheme } from "../_kit/theme";

// Only the tabs that do not fit leave the strip: the engine measures the tab list and hides them
// (tab overflow), keeping the selected tab in view, and Dockable.TabOverflowTrigger (rendered only
// while tabs are hidden) is the trigger of a Fragiola Select listing just those. Picking one
// selects it, which brings it into the strip; another tab goes to the select in its place.

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

function OverflowStrip({ tabset }: { tabset: TabSetNode }) {
    const { engine } = useDockable();
    const { hidden } = useTabOverflow(tabset);
    const [themeRef, theme] = useStageTheme();
    // a tab with no name (an icon-only tab) is named by its altName in the menu
    const label = (tab: TabNode) => tab.getName() || tab.getAltName();

    return (
        <div className={styles.tabsetHeader}>
            <Dockable.TabList
                aria-label={tabset.getName() ?? "Tabs"}
                data-kit-tablist=""
                className={styles.tabList}
            >
                {(tab) => <KitTab node={tab} />}
            </Dockable.TabList>
            <Select.Root
                value={null}
                onValueChange={(id) => {
                    if (typeof id === "string") {
                        engine.doAction(Actions.selectTab(id));
                    }
                }}
            >
                {/* the package's trigger (measured, shown only while tabs are hidden), rendered
                    as the Select's trigger */}
                <Dockable.TabOverflowTrigger
                    ref={themeRef}
                    aria-label={`${hidden.length} more tabs`}
                    render={
                        <Select.Trigger className="my-1 me-1 h-auto w-auto shrink-0 gap-1 self-center px-2 py-0.5 text-xs" />
                    }
                >
                    {`+${hidden.length}`}
                </Dockable.TabOverflowTrigger>
                <Select.Content data-example-theme={theme}>
                    {hidden.map((tab) => (
                        <Select.Item key={tab.getId()} value={tab.getId()}>
                            {label(tab)}
                        </Select.Item>
                    ))}
                </Select.Content>
            </Select.Root>
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
