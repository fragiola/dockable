import {
    Actions,
    DockLocation,
    type IJsonModel,
    type LayoutEngine,
    type Model,
    type Node,
    TabNode,
    type TabSetNode,
} from "@fragiola/dockable";
import { FILES, fileName } from "./files";

// The workbench's state outside the layout: file contents ("disk" and unsaved buffers), the
// layout JSON with its save/restore, and how a file becomes a tab.

/** What an editor tab keeps in its `config`: the file, and whether it has unsaved changes. */
export interface EditorConfig {
    path: string;
    dirty?: boolean;
}

/** The saved files and the unsaved edits, per mount of the example. */
export function createWorkspace() {
    const disk = new Map(Object.entries(FILES));
    const buffers = new Map<string, string>();
    return {
        read: (path: string) => buffers.get(path) ?? disk.get(path) ?? "",
        write: (path: string, text: string) => {
            if (text === disk.get(path)) buffers.delete(path);
            else buffers.set(path, text);
        },
        isDirty: (path: string) => buffers.has(path),
        save: (path: string) => {
            const text = buffers.get(path);
            if (text !== undefined) disk.set(path, text);
            buffers.delete(path);
        },
        discard: (path: string) => buffers.delete(path),
    };
}

export type Workspace = ReturnType<typeof createWorkspace>;

/** The tab id is derived from the path, so "is this file open?" is one `getNodeById`. */
export function tabId(path: string): string {
    return `file:${path}`;
}

export function editorConfig(node: Node): EditorConfig | undefined {
    return node instanceof TabNode && node.getComponent() === "editor"
        ? (node.getConfig() as EditorConfig)
        : undefined;
}

export function editorTab(path: string, dirty = false) {
    return {
        type: "tab" as const,
        id: tabId(path),
        name: fileName(path),
        component: "editor",
        config: { path, dirty } satisfies EditorConfig,
    };
}

export const defaultLayout: IJsonModel = {
    global: { tabEnableRename: false, borderSize: 208 },
    // the explorer on the left and the terminal and problems below are borders: side bars whose
    // selected tab opens a panel beside the editors (click the selected tab to close it)
    borders: [
        {
            type: "border",
            location: "left",
            selected: 0,
            children: [
                {
                    type: "tab",
                    name: "Explorer",
                    component: "explorer",
                    enableClose: false,
                    enableDrag: false,
                },
            ],
        },
        {
            type: "border",
            location: "bottom",
            selected: 0,
            size: 180,
            children: [
                {
                    type: "tab",
                    name: "Terminal",
                    component: "terminal",
                    enableClose: false,
                },
                {
                    type: "tab",
                    name: "Problems",
                    component: "problems",
                    enableClose: false,
                },
            ],
        },
    ],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "editors",
                // the editor area stays when its last file is closed
                enableDeleteWhenEmpty: false,
                children: [
                    editorTab("src/app.ts"),
                    editorTab("src/store.ts"),
                    editorTab("README.md"),
                ],
            },
        ],
    },
};

/** Where a file opens: the active tabset, else the first one (borders are not tabsets). */
function editorTarget(model: Model): TabSetNode | undefined {
    return model.getActiveTabset() ?? model.getFirstTabSet();
}

/** Opens a file: selects its tab when it is already open, adds one otherwise. */
export function openFile(engine: LayoutEngine, model: Model, path: string) {
    if (model.getNodeById(tabId(path))) {
        engine.doAction(Actions.selectTab(tabId(path)));
        return;
    }
    const target = editorTarget(model);
    if (target) {
        engine.doAction(
            Actions.addTab(
                editorTab(path),
                target.getId(),
                DockLocation.CENTER,
                -1,
                true,
            ),
        );
    }
}

// ── Save and restore ────────────────────────────────────────────────────────

// v2: the explorer and the bottom panel became borders (a v1 layout has none)
const STORAGE_KEY = "dockable-docs:ide-workbench:layout:v2";

/** The layout saved on the last visit, or the default one. Storage may be unavailable. */
export function loadLayout(): IJsonModel {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            // unsaved edits are not persisted, so a restored tab is never dirty
            return JSON.parse(saved, (key, value) =>
                key === "dirty" ? false : value,
            ) as IJsonModel;
        }
    } catch {
        // private mode or corrupt data: fall back to the default
    }
    return defaultLayout;
}

export function saveLayout(model: Model) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model.toJson()));
    } catch {
        // storage full or blocked: the layout just is not remembered
    }
}

export function forgetLayout() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // nothing to forget
    }
}
