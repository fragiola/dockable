import { Component, input } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type KeyMap,
    type LayoutJson,
    resolveKeyMap,
    type TabOf,
    toAriaKeyShortcuts,
} from "@fragiola/dockable-angular";
import { TOOLTIP } from "#/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import { LogPanel, TablePanel } from "../_kit/data";
import * as styles from "./styles";

type Types = {
    tabs: {
        keys: undefined;
        doc: { text: string };
        table: undefined;
        log: undefined;
    };
    // a tabset's name is its tab list's accessible name (the TabSet below reads `data.name`)
    tabset: { name: string };
};

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "documents",
                data: { name: "Documents" },
                weight: 55,
                children: [
                    { component: "keys", label: "Keys" },
                    {
                        component: "doc",
                        label: "Readme",
                        data: {
                            text: "Every part of the layout is reachable without a mouse: the tab strips, the splitters and each tab's content. The Keys tab lists them all.",
                        },
                    },
                    {
                        component: "doc",
                        label: "License",
                        data: {
                            text: "MIT. Permission is hereby granted, free of charge, to any person obtaining a copy of this software, to deal in the software without restriction.",
                        },
                        closable: false,
                    },
                ],
            },
            {
                type: "tabset",
                data: { name: "Tools" },
                weight: 45,
                children: [
                    { component: "table", label: "Search" },
                    { component: "log", label: "History" },
                ],
            },
        ],
    },
    active: "documents",
};

/**
 * The command shortcuts, merged over `defaultKeyMap` (closeTab: Ctrl+Delete). Tabset cycling
 * and the tab/content toggle are off by default; this example turns them on. Pick modified
 * keys: single printable characters must be remappable (WCAG 2.1.4). The arrows, Home/End,
 * Enter and Space are the ARIA patterns' own keys and are not configurable.
 */
const keyMap: KeyMap = {
    focusNextTabset: "Ctrl+Alt+ArrowRight",
    focusPreviousTabset: "Ctrl+Alt+ArrowLeft",
    focusTabToggle: "Ctrl+Enter",
};
const keys = resolveKeyMap(keyMap);

/** `"Control+Alt+ArrowRight"` → `["Control", "Alt", "ArrowRight"]`, for `<kbd>` rendering. */
@Component({
    selector: "example-keys",
    host: { class: "contents" },
    template: `
        @if (aria()) {
            <span [class]="styles.keys">
                @for (key of aria()!.split("+"); track key) {
                    <kbd [class]="styles.key">{{ key }}</kbd>
                }
            </span>
        }
    `,
})
class Keys {
    readonly spec = input<string | undefined>();
    protected readonly styles = styles;
    protected readonly aria = () => toAriaKeyShortcuts(this.spec());
}

const LEGEND: { keys: string[]; does: string }[] = [
    { keys: ["Tab"], does: "Between the tab strips and the splitters" },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "Previous or next tab in the strip",
    },
    { keys: ["Home", "End"], does: "First or last tab" },
    {
        keys: ["Enter", "Space"],
        does: "Select the focused tab; on the selected one, enter its content",
    },
    {
        keys: ["ArrowLeft", "ArrowRight"],
        does: "On a focused splitter: resize",
    },
];

/** A panel listing every key, fixed and configured. */
@Component({
    selector: "example-keys-panel",
    imports: [PanelBody, Keys],
    host: { class: "contents" },
    template: `
        <kit-panel-body title="Keyboard">
            <dl [class]="styles.legend">
                @for (row of LEGEND; track row.does) {
                    <div [class]="styles.legendRow">
                        <dt [class]="styles.legendKeys">
                            @for (key of row.keys; track key) {
                                <example-keys [spec]="key" />
                            }
                        </dt>
                        <dd [class]="styles.legendAction">{{ row.does }}</dd>
                    </div>
                }
                <dt><example-keys [spec]="keys.focusNextTabset" /></dt>
                <dd [class]="styles.legendAction">Next tabset, from anywhere in the layout</dd>
                <dt><example-keys [spec]="keys.focusPreviousTabset" /></dt>
                <dd [class]="styles.legendAction">Previous tabset</dd>
                <dt><example-keys [spec]="keys.focusTabToggle" /></dt>
                <dd [class]="styles.legendAction">Between a tab and its content</dd>
                <dt><example-keys [spec]="keys.closeTab" /></dt>
                <dd [class]="styles.legendAction">Close the focused tab</dd>
            </dl>
        </kit-panel-body>
    `,
})
class KeysPanel {
    protected readonly styles = styles;
    protected readonly LEGEND = LEGEND;
    protected readonly keys = keys;
}

@Component({
    selector: "example-keyboard",
    imports: [DOCKABLE, TOOLTIP, PanelBody, TablePanel, LogPanel, KeysPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.frame">
            <!-- the shortcuts above, merged over the defaults -->
            <div [dockableRoot]="model" [keyMap]="keyMap" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <div [dockableTabSet]="node" [class]="styles.tabset">
                                <div [class]="styles.strip">
                                    <!-- the tabset's name, from its data (a tabset made by a drop has none) -->
                                    <div
                                        dockableTabList
                                        [attr.aria-label]="node.data?.name || 'Tabs'"
                                        [class]="styles.tabList"
                                    >
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <!-- Each tab is a tooltip trigger: kitTooltipTrigger on the [dockableTab] element opens the
                                                 tooltip when the tab gets keyboard focus too. It lists the tab's
                                                 aria-keyshortcuts: the package advertises the same bindings it
                                                 handles, so what the tooltip reads is what the keyboard does. -->
                                            <div [dockableTab]="tab" [kitTooltipTrigger]="tip" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                            <ng-template #tip>
                                                <div kitTooltipContent>
                                                    <div data-testid="tab-shortcuts" [class]="styles.shortcuts">
                                                        @for (item of shortcutsOf(tab); track item.name) {
                                                            <div [class]="styles.shortcut">
                                                                <span>{{ item.name }}</span>
                                                                <code [class]="styles.shortcutKeys">{{ toAriaKeyShortcuts(item.spec) }}</code>
                                                            </div>
                                                        }
                                                    </div>
                                                </div>
                                            </ng-template>
                                        </ng-template>
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                            </div>
                        }
                    </ng-template>
                    <ng-template dockableRowSplitter let-node="node" let-index="index">
                        <div
                            [dockableSplitter]="node"
                            [index]="index"
                            aria-label="Resize"
                            [class]="styles.splitter"
                        >
                            <span aria-hidden="true" [class]="styles.splitterGrip"></span>
                        </div>
                    </ng-template>
                </div>
                <ng-template [dockablePanels]="model" let-tab>
                    <div [dockablePanel]="tab" [class]="styles.panel">
                        @switch (tab.component) {
                            @case ("keys") {
                                <example-keys-panel />
                            }
                            @case ("doc") {
                                <kit-panel-body [title]="tab.label">
                                    <p>{{ tab.data.text }}</p>
                                </kit-panel-body>
                            }
                            @case ("table") {
                                <kit-table-panel />
                            }
                            @case ("log") {
                                <kit-log-panel />
                            }
                        }
                    </div>
                </ng-template>
                <div
                    dockableDropIndicator
                    #indicator="dockableDropIndicator"
                    [class]="styles.dropIndicator(indicator.state())"
                ></div>
            </div>
        </div>
    `,
})
export default class Keyboard {
    protected readonly styles = styles;
    protected readonly keyMap = keyMap;
    protected readonly toAriaKeyShortcuts = toAriaKeyShortcuts;
    protected readonly model = createModel<Types>(json);

    /**
     * The same two bindings `[dockableTab]` puts in its aria-keyshortcuts; the model says whether
     * the tab may close (a dry run of `tab.close`). Read when the tooltip opens.
     */
    protected shortcutsOf(tab: TabOf<Types>) {
        const closeable = this.model.can("tab.close", { tabId: tab.id });
        return [
            { name: "Enter or leave the content", spec: keys.focusTabToggle },
            { name: "Close", spec: closeable ? keys.closeTab : undefined },
        ].filter((item) => item.spec !== undefined);
    }
}
