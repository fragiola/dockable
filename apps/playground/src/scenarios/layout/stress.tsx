import {
    Actions,
    type IJsonModel,
    type IJsonRowNode,
    type IJsonTabSetNode,
    Model,
    type TabSetNode,
} from "@fragiola/dockable";
import { useDockable } from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "#/examples/_kit/card";
import { DockLayout } from "#/examples/_kit/layout";
import * as styles from "#/examples/_kit/styles";

// A deep tree under load: rows three levels down, twelve tabsets, eight tabs each, tight minimum
// sizes, and a maximize button on every tabset (text arrows: this app has no icon package). For geometry (splitter limits, nested weights,
// maximize), a crowded strip, and hot reload with many panels mounted.

const TABS_PER_TABSET = 8;

let tabsetCount = 0;

function tabset(weight = 1): IJsonTabSetNode {
    tabsetCount += 1;
    const n = tabsetCount;
    return {
        type: "tabset",
        weight,
        minWidth: 80,
        minHeight: 60,
        children: Array.from({ length: TABS_PER_TABSET }, (_, i) => ({
            type: "tab",
            name: `T${n}.${i + 1}`,
            component: "body",
        })),
    };
}

function row(
    weight: number,
    children: (IJsonRowNode | IJsonTabSetNode)[],
): IJsonRowNode {
    return { type: "row", weight, children };
}

function layout(): IJsonModel {
    tabsetCount = 0;
    return {
        global: {},
        borders: [],
        layout: {
            type: "row",
            children: [
                row(30, [tabset(), row(1, [tabset(), tabset()]), tabset()]),
                row(40, [
                    row(1, [tabset(2), row(1, [tabset(), tabset()])]),
                    tabset(),
                ]),
                row(30, [tabset(), tabset(), row(1, [tabset(), tabset()])]),
            ],
        },
    };
}

function MaximizeButton({ tabset }: { tabset: TabSetNode }) {
    const { engine, layoutId } = useDockable();
    const maximized = tabset.isMaximized();
    return (
        <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            aria-pressed={maximized}
            className={styles.iconButton}
            onClick={() =>
                engine.doAction(
                    Actions.maximizeToggle(tabset.getId(), layoutId),
                )
            }
        >
            {maximized ? "⤡" : "⤢"}
        </button>
    );
}

export default function Stress() {
    const [model] = useState(() => Model.fromJson(layout()));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => (
                <PanelBody title={tab.getName()}>
                    <p className="text-palette-accent/85">
                        {`${tab.getParent()?.getId() ?? ""} · ${tab.getId()}`}
                    </p>
                </PanelBody>
            )}
            renderActions={(node) => <MaximizeButton tabset={node} />}
            edgeIndicators
        />
    );
}
