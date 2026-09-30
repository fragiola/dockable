import {
    Actions,
    DockLocation,
    type IJsonModel,
    Model,
    TabSetNode,
} from "@fragiola/dockable";
import { useRef, useState } from "react";
import { Card } from "#/examples/_kit/card";
import { DockLayout } from "#/examples/_kit/layout";
import * as styles from "#/examples/_kit/styles";
import { useInspector } from "../../inspector/context";

// The main Actions, one button each, against the active tabset (else the first) and its selected
// tab, with the Inspector on: each click is one entry in its log, and the model JSON follows.
// Everything goes through `model.doAction`, as any consumer would.

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
                    { type: "tab", name: "One", component: "card" },
                    { type: "tab", name: "Two", component: "card" },
                ],
            },
            {
                type: "row",
                weight: 40,
                children: [
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Three", component: "card" },
                        ],
                    },
                    {
                        type: "tabset",
                        children: [
                            { type: "tab", name: "Four", component: "card" },
                        ],
                    },
                ],
            },
        ],
    },
};

function tabsets(model: Model): TabSetNode[] {
    const found: TabSetNode[] = [];
    model.visitNodes((node) => {
        if (node instanceof TabSetNode) found.push(node);
    });
    return found;
}

function activeTabset(model: Model): TabSetNode | undefined {
    return model.getActiveTabset() ?? tabsets(model)[0];
}

export default function ActionsScenario() {
    const [model] = useState(() => Model.fromJson(json));
    const added = useRef(0);
    useInspector(model);

    const newTab = () => {
        added.current += 1;
        return {
            type: "tab" as const,
            name: `New ${added.current}`,
            component: "card",
        };
    };

    const buttons: [string, () => void][] = [
        [
            "Add tab",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return;
                model.doAction(
                    Actions.addTab(
                        newTab(),
                        tabset.getId(),
                        DockLocation.CENTER,
                        -1,
                        true,
                    ),
                );
            },
        ],
        [
            "Add two (group)",
            () => {
                const tabset = activeTabset(model);
                if (!tabset) return;
                model.doAction(
                    Actions.group([
                        Actions.addTab(
                            newTab(),
                            tabset.getId(),
                            DockLocation.CENTER,
                            -1,
                        ),
                        Actions.addTab(
                            newTab(),
                            tabset.getId(),
                            DockLocation.CENTER,
                            -1,
                        ),
                    ]),
                );
            },
        ],
        [
            "Select next",
            () => {
                const tabset = activeTabset(model);
                const tabs = tabset?.getTabNodes() ?? [];
                const next =
                    tabs[((tabset?.getSelected() ?? -1) + 1) % tabs.length];
                if (next) model.doAction(Actions.selectTab(next.getId()));
            },
        ],
        [
            "Move to next tabset",
            () => {
                const all = tabsets(model);
                const tabset = activeTabset(model);
                const tab = tabset?.getSelectedNode();
                if (!tabset || !tab || all.length < 2) return;
                const target = all[(all.indexOf(tabset) + 1) % all.length];
                if (!target) return;
                model.doAction(
                    Actions.moveNode(
                        tab.getId(),
                        target.getId(),
                        DockLocation.CENTER,
                        -1,
                        true,
                    ),
                );
            },
        ],
        [
            "Rename",
            () => {
                const tab = activeTabset(model)?.getSelectedNode();
                if (tab) {
                    model.doAction(
                        Actions.renameTab(tab.getId(), `${tab.getName()}*`),
                    );
                }
            },
        ],
        [
            "Maximize",
            () => {
                const tabset = activeTabset(model);
                if (tabset) {
                    model.doAction(Actions.maximizeToggle(tabset.getId()));
                }
            },
        ],
        [
            "Even weights",
            () => {
                const row = model.getRootRow();
                if (!row) return;
                model.doAction(
                    Actions.adjustWeights(
                        row.getId(),
                        row.getChildren().map(() => 50),
                    ),
                );
            },
        ],
        [
            "Delete tab",
            () => {
                const tab = activeTabset(model)?.getSelectedNode();
                if (tab) model.doAction(Actions.deleteTab(tab.getId()));
            },
        ],
    ];

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={styles.toolbar}>
                {buttons.map(([name, run]) => (
                    <button
                        key={name}
                        type="button"
                        className={styles.button}
                        onClick={run}
                    >
                        {name}
                    </button>
                ))}
            </div>
            <DockLayout
                model={model}
                renderContent={(tab) => <Card tab={tab} />}
                edgeIndicators
            />
        </div>
    );
}
