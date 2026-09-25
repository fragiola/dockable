"use client";

import {
    type Action,
    Actions,
    type LayoutEngine,
    Model,
    TabNode,
} from "@fragiola/dockable";
import { GitBranch } from "lucide-react";
import { useRef, useState } from "react";
import { Clickable } from "@/components/atoms/clickable";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { EngineBridge } from "../_kit/engine-bridge";
import { DockLayout } from "../_kit/layout";
import { usePopupTheme } from "../_kit/theme";
import { Explorer } from "./explorer";
import { EditorPanel, ProblemsPanel, TerminalPanel } from "./panels";
import { WorkbenchTabSet } from "./tabs";
import {
    createWorkspace,
    defaultLayout,
    editorConfig,
    forgetLayout,
    loadLayout,
    openFile,
    saveLayout,
} from "./workspace";

// A code-editor workbench. The explorer and the status bar live outside the layout and drive it
// through the engine; the tabs follow their content (a dot while modified); closing a modified
// tab is intercepted in onAction, whatever closed it (button, menu, Ctrl+Delete); and the layout
// is saved on every change and restored on the next visit.

export default function IdeWorkbench() {
    const [workspace] = useState(createWorkspace);
    const [model, setModel] = useState(() => Model.fromJson(loadLayout()));
    const [engine, setEngine] = useState<LayoutEngine | null>(null);
    const [, setRevision] = useState(0);
    // tabs waiting for an answer to "save changes?", and the ones already answered
    const [pending, setPending] = useState<string[]>([]);
    const confirmed = useRef(new Set<string>());
    const container = useRef<HTMLDivElement | null>(null);
    const popupTheme = usePopupTheme(container);

    const onAction = (action: Action) => {
        if (action.type === Actions.DELETE_TAB) {
            const id = action.data.node as string;
            const node = model.getNodeById(id);
            if (node && editorConfig(node)?.dirty) {
                if (!confirmed.current.has(id)) {
                    // veto: ask first, and close from the dialog
                    setPending((ids) =>
                        ids.includes(id) ? ids : [...ids, id],
                    );
                    return undefined;
                }
                confirmed.current.delete(id);
            }
        }
        return action;
    };

    const onModelChange = (changed: Model) => {
        saveLayout(changed);
        setRevision((n) => n + 1); // the explorer and status bar read the model
    };

    const open = (path: string) => {
        if (engine) openFile(engine, model, path);
    };

    const resetLayout = () => {
        forgetLayout();
        setModel(Model.fromJson(defaultLayout));
    };

    // answer the first pending question
    const pendingTab = pending[0] ? model.getNodeById(pending[0]) : undefined;
    const pendingName =
        pendingTab instanceof TabNode ? pendingTab.getName() : "";
    const pendingConfig = pendingTab ? editorConfig(pendingTab) : undefined;
    const answer = (choice: "save" | "discard" | "cancel") => {
        const id = pending[0];
        setPending((ids) => ids.slice(1));
        if (!id || !pendingConfig || choice === "cancel") return;
        if (choice === "save") workspace.save(pendingConfig.path);
        else workspace.discard(pendingConfig.path);
        confirmed.current.add(id);
        engine?.doAction(Actions.deleteTab(id));
    };

    // what the explorer and the status bar show, read from the model
    const dirtyPaths = new Set<string>();
    model.visitNodes((node) => {
        const config = editorConfig(node);
        if (config?.dirty) dirtyPaths.add(config.path);
    });
    const activeTab = model.getActiveTabset()?.getSelectedNode();
    const activePath = activeTab ? editorConfig(activeTab)?.path : undefined;

    const renderContent = (tab: TabNode) => {
        switch (tab.getComponent()) {
            case "editor":
                return <EditorPanel tab={tab} workspace={workspace} />;
            case "terminal":
                return <TerminalPanel workspace={workspace} />;
            case "problems":
                return <ProblemsPanel onOpen={open} />;
            default:
                return null;
        }
    };

    return (
        <div
            ref={container}
            className="flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)"
        >
            <div className="flex min-h-0 flex-1">
                <Explorer
                    activePath={activePath}
                    dirtyPaths={dirtyPaths}
                    onOpen={open}
                    onResetLayout={resetLayout}
                />
                {/* hairline splitters with a wider grab area, whatever the theme */}
                <div className="flex min-w-0 flex-1 flex-col [--dk-splitter-grab:7px] [--dk-splitter-size:1px]">
                    <DockLayout
                        model={model}
                        onAction={onAction}
                        onModelChange={onModelChange}
                        renderTabSet={(node) => <WorkbenchTabSet node={node} />}
                        renderContent={renderContent}
                    >
                        <EngineBridge onEngine={setEngine} />
                    </DockLayout>
                </div>
            </div>

            <footer className="palette-blue flex h-6 shrink-0 items-center gap-4 bg-palette-base px-3 text-xs text-palette-contrast">
                <span className="flex items-center gap-1">
                    <GitBranch aria-hidden="true" className="size-3.5" />
                    main
                </span>
                <span data-testid="unsaved-count">
                    {dirtyPaths.size === 1
                        ? "1 unsaved file"
                        : `${dirtyPaths.size} unsaved files`}
                </span>
                <span className="ms-auto">{activePath ?? ""}</span>
            </footer>

            <AlertDialog.Root
                open={pendingConfig !== undefined}
                onOpenChange={(isOpen) => {
                    if (!isOpen) answer("cancel");
                }}
            >
                <AlertDialog.Portal>
                    <AlertDialog.Backdrop />
                    <AlertDialog.Content {...popupTheme}>
                        <AlertDialog.Header>
                            <AlertDialog.Title>
                                {`Save changes to ${pendingName}?`}
                            </AlertDialog.Title>
                            <AlertDialog.Description>
                                Your changes will be lost if you close the file
                                without saving.
                            </AlertDialog.Description>
                        </AlertDialog.Header>
                        <AlertDialog.Footer>
                            <Clickable.Button
                                variant="ghost"
                                size="sm"
                                onClick={() => answer("discard")}
                            >
                                Don't save
                            </Clickable.Button>
                            <Clickable.Button
                                variant="outline"
                                size="sm"
                                onClick={() => answer("cancel")}
                            >
                                Cancel
                            </Clickable.Button>
                            <Clickable.Button
                                size="sm"
                                className="palette-blue"
                                onClick={() => answer("save")}
                            >
                                Save
                            </Clickable.Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Content>
                </AlertDialog.Portal>
            </AlertDialog.Root>
        </div>
    );
}
