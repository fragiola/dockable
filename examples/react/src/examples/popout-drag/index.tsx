"use client";

import {
    createModel,
    type LayoutJson,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import {
    AppWindow,
    ArrowDownToLine,
    SquareArrowOutUpRight,
} from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Tabs move between windows like between tabsets: pop one out, then drag tabs into the window or
// out of it. The page's windows share one drag state, so a drag that starts in one window drops in
// another; each window draws its own outline (the kit puts a DropIndicator in Dockable.Popout).
// The content element moves with the tab, so the counter and the notes keep their values.

// What the layout holds: one tab component, named in its data.
type Types = { tabs: { card: { name: string } } };

const card = (name: string) => ({ component: "card" as const, data: { name } });

const json: LayoutJson<Types> = {
    version: 1,
    // every tab may go to a window (`tab.popout`, `tabset.popout`)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 50,
                children: [card("Orders"), card("Customers"), card("Invoices")],
            },
            {
                type: "tabset",
                weight: 50,
                children: [card("Chart"), card("Notes")],
            },
        ],
    },
};

/** Two triggers: the selected tab, and the whole tabset. Each docks back from a window. */
function WindowButtons({ tabset }: { tabset: TabsetNode<Types> }) {
    return (
        <>
            <Dockable.PopoutTrigger
                aria-label="Pop out the tab"
                data-testid="popout-tab"
                className={styles.iconButton}
            >
                <SquareArrowOutUpRight
                    aria-hidden
                    className="size-3.5 in-data-[mode=dock]:hidden"
                />
                <ArrowDownToLine
                    aria-hidden
                    className="hidden size-3.5 in-data-[mode=dock]:block"
                />
            </Dockable.PopoutTrigger>
            {/* one trigger per tabset is enough in a window: the tab trigger docks back */}
            {tabset.children.length > 1 ? (
                <Dockable.PopoutTrigger
                    target="tabset"
                    aria-label="Pop out the whole tabset"
                    data-testid="popout-tabset"
                    className={`${styles.iconButton} data-[mode=dock]:hidden`}
                >
                    <AppWindow aria-hidden className="size-3.5" />
                </Dockable.PopoutTrigger>
            ) : null}
        </>
    );
}

export default function PopoutDrag() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderActions={(tabset) => <WindowButtons tabset={tabset} />}
            renderContent={(tab) => (
                <Card tab={tab}>
                    <p className="text-sm text-palette-accent/85">
                        Pop this tab out, then drag tabs into its window, and
                        back into this one.
                    </p>
                </Card>
            )}
        />
    );
}
