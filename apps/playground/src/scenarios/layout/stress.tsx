import {
    createModel,
    type LayoutJson,
    type RowJson,
    type TabsetJson,
    type TabsetNode,
} from "@fragiola/dockable";
import { useDockable, useModelState } from "@fragiola/dockable-react";
import { useState } from "react";
import { PanelBody } from "#/examples/_kit/card";
import { DockLayout } from "#/examples/_kit/layout";
import * as styles from "#/examples/_kit/styles";

// A deep tree under load: rows three levels down, twelve tabsets, eight tabs each, tight minimum
// sizes, and a maximize button on every tabset (text arrows: this app has no icon package). For geometry (splitter limits, nested weights,
// maximize), a crowded strip, and hot reload with many panels mounted.

type Types = { tabs: { body: { name: string } } };

const TABS_PER_TABSET = 8;

let tabsetCount = 0;

function tabset(weight = 1): TabsetJson<Types> {
    tabsetCount += 1;
    const n = tabsetCount;
    return {
        type: "tabset",
        weight,
        minWidth: 80,
        minHeight: 60,
        children: Array.from({ length: TABS_PER_TABSET }, (_, i) => ({
            component: "body",
            data: { name: `T${n}.${i + 1}` },
        })),
    };
}

function row(
    weight: number,
    children: (RowJson<Types> | TabsetJson<Types>)[],
): RowJson<Types> {
    return { type: "row", weight, children };
}

function layout(): LayoutJson<Types> {
    tabsetCount = 0;
    return {
        version: 1,
        root: {
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

function MaximizeButton({ tabset }: { tabset: TabsetNode<Types> }) {
    const { run, layoutId } = useDockable<Types>();
    const maximized = useModelState<Types, boolean>(
        (_state, model) => model.maximizedTabset(layoutId)?.id === tabset.id,
    );
    return (
        <button
            type="button"
            aria-label={maximized ? "Restore" : "Maximize"}
            aria-pressed={maximized}
            className={styles.iconButton}
            onClick={() =>
                run("tabset.maximize", { tabset: tabset.id, value: !maximized })
            }
        >
            {maximized ? "⤡" : "⤢"}
        </button>
    );
}

/** where a tab sits: its tabset's id and its own */
function TabPlace({ id }: { id: string }) {
    const parent = useModelState<Types, string>(
        (_state, model) => model.parentOf(id)?.id ?? "",
    );
    return <p className="text-palette-accent/85">{`${parent} · ${id}`}</p>;
}

export default function Stress() {
    const [model] = useState(() => createModel<Types>(layout()));
    return (
        <DockLayout
            model={model}
            renderContent={(tab) => (
                <PanelBody title={tab.data.name}>
                    <TabPlace id={tab.id} />
                </PanelBody>
            )}
            renderActions={(node) => <MaximizeButton tabset={node} />}
            edgeIndicators
        />
    );
}
