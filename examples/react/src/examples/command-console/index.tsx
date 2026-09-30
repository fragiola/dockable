"use client";

import { createModel, type LayoutJson } from "@fragiola/dockable";
import { useState } from "react";
import { PanelBody } from "../_kit/card";
import { DockLayout } from "../_kit/layout";
import { CommandConsole } from "./console";

// The layout as data an assistant can drive: every change is a named command with a JSON Schema,
// so a script, a test, a chat assistant or this console can run it by name plus JSON. The console
// beside the layout lists the commands (`model.commands()`), runs one typed as JSON
// (`model.dispatch`), shows its result or its structured error, and logs every change
// (`model.subscribe`).

type Types = { tabs: { note: { name: string; text: string } } };

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left",
                weight: 55,
                children: [
                    {
                        id: "readme",
                        component: "note",
                        data: {
                            name: "Readme",
                            text: "Run a command from the console: select, move or add a tab.",
                        },
                    },
                    {
                        id: "todo",
                        component: "note",
                        data: {
                            name: "Todo",
                            text: "Every change the console makes goes through the same bus as a drag.",
                        },
                    },
                ],
            },
            {
                type: "tabset",
                id: "right",
                weight: 45,
                children: [
                    {
                        id: "ideas",
                        component: "note",
                        data: {
                            name: "Ideas",
                            text: "Hand the commands to an assistant as tools.",
                        },
                    },
                ],
            },
        ],
    },
};

export default function CommandConsoleExample() {
    const [model] = useState(() => createModel<Types>(json));
    return (
        <div className="flex min-h-0 flex-1 max-md:flex-col">
            <DockLayout
                model={model}
                className="min-w-0"
                renderContent={(tab) => (
                    <PanelBody title={tab.data.name}>
                        <p className="text-palette-accent/85">
                            {tab.data.text}
                        </p>
                        <p className="font-mono text-xs text-palette-accent/85">
                            {`id: ${tab.id}`}
                        </p>
                    </PanelBody>
                )}
            />
            <CommandConsole model={model} />
        </div>
    );
}
