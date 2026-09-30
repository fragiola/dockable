"use client";

import {
    createModel,
    type LayoutJson,
    MAIN_LAYOUT,
    type TabsetNode,
} from "@fragiola/dockable";
import { Dockable, useDockable } from "@fragiola/dockable-react";
import { ArrowDownToLine, SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Pop a tab out into its own browser window, and back. The core opens the window (`popoutURL`,
// served under the site's base path), copies the page's styles into it and moves the tab's
// content element there: the counter and the notes keep their state both ways. Closing the window
// docks its tabs back into the main layout (the default "dock" policy). A tab can also be dragged
// from the window into the main layout, and back (see the popout-drag example).

type Types = { tabs: { card: { name: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    // tabs may be popped out (off by default)
    defaults: { tab: { enablePopout: true } },
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { component: "card", data: { name: "Editor" } },
                    { component: "card", data: { name: "Preview" } },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { component: "card", data: { name: "Chat" } },
                    {
                        component: "card",
                        data: { name: "Pinned here" },
                        // this one stays in the main window
                        enablePopout: false,
                    },
                ],
            },
        ],
    },
};

/**
 * `Dockable.PopoutTrigger` pops the selected tab out and, in a popout, docks it back into the main
 * layout's active tabset. It renders nothing when the tab cannot pop out (here "Pinned here"), and
 * says which way it goes with `data-mode` ("popout" or "dock"): the icons follow it.
 */
function PopoutButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { model } = useDockable<Types>();
    const selected = model.selectedTab(tabset.id);
    const inWindow = model.layoutOf(tabset.id) !== MAIN_LAYOUT;
    const name = selected?.data.name ?? "";
    return (
        <Dockable.PopoutTrigger
            aria-label={inWindow ? `Dock ${name} back` : `Pop out ${name}`}
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
    );
}

export default function Popout() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <DockLayout
            model={model}
            renderActions={(tabset) => <PopoutButton tabset={tabset} />}
            renderContent={(tab) => (
                <Card tab={tab}>
                    <p className="text-sm text-palette-accent/85">
                        Count, type a note, then pop the tab out with the button
                        in its header. Dock it back from the window, or close
                        the window.
                    </p>
                </Card>
            )}
        />
    );
}
