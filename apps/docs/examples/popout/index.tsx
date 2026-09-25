"use client";

import {
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    type TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { ArrowDownToLine, SquareArrowOutUpRight } from "lucide-react";
import { useState } from "react";
import { Card } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import * as styles from "../_kit/styles";

// Pop a tab out into its own browser window, and back. The core opens the window (`popoutURL`,
// served under the site's base path), copies the page's styles into it and moves the tab's
// content element there: the counter and the notes keep their state both ways. The kit copies
// the example theme into the window (gap 3). Closing the window docks its tabs back into the main
// layout (the default "dock" policy).

const json: IJsonModel = {
    // tabs may be popped out (off by default)
    global: { tabEnablePopout: true },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                weight: 55,
                children: [
                    { type: "tab", name: "Editor", component: "card" },
                    { type: "tab", name: "Preview", component: "card" },
                ],
            },
            {
                type: "tabset",
                weight: 45,
                children: [
                    { type: "tab", name: "Chat", component: "card" },
                    {
                        type: "tab",
                        name: "Pinned here",
                        component: "card",
                        // this one stays in the main window
                        enablePopout: false,
                    },
                ],
            },
        ],
    },
};

/**
 * In the main window: pop the selected tab out. In a popout: dock it back into the main
 * layout's active tabset (or its first). The button needs the selected tab's `enablePopout`
 * and the engine's `isSupportsPopout()` (gap 7: no popout trigger primitive yet).
 */
function PopoutButton({ tabset }: { tabset: TabSetNode }) {
    const { engine, mainEngine, model } = useDockable();
    const selected = tabset.getSelectedNode() as TabNode | undefined;
    if (!selected) {
        return null;
    }
    if (tabset.getLayoutId() !== Model.MAIN_LAYOUT_ID) {
        return (
            <button
                type="button"
                aria-label={`Dock ${selected.getName()} back`}
                className={styles.iconButton}
                onClick={() => {
                    const target =
                        model.getActiveTabset(Model.MAIN_LAYOUT_ID) ??
                        model.getFirstTabSet();
                    if (target) {
                        // the main engine: the tab moves into the main layout
                        mainEngine.doAction(
                            Actions.moveNode(
                                selected.getId(),
                                target.getId(),
                                DockLocation.CENTER,
                                -1,
                            ),
                        );
                    }
                }}
            >
                <ArrowDownToLine aria-hidden className="size-3.5" />
            </button>
        );
    }
    if (!selected.isEnablePopout() || !mainEngine.isSupportsPopout()) {
        return null;
    }
    return (
        <button
            type="button"
            aria-label={`Pop out ${selected.getName()}`}
            className={styles.iconButton}
            onClick={() =>
                engine.doAction(Actions.popoutTab(selected.getId(), "window"))
            }
        >
            <SquareArrowOutUpRight aria-hidden className="size-3.5" />
        </button>
    );
}

export default function Popout() {
    const [model] = useState(() => Model.fromJson(json));
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
