"use client";

import { type Model, type TabOf, veto } from "@fragiola/dockable";
import { Bug, FolderTree, GitBranch, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { AlertDialog } from "#/components/ui/alert-dialog";
import { Tooltip } from "#/components/ui/tooltip";
import { type BorderOptions, DockLayout } from "../_kit/layout";
import { usePopupTheme } from "../_kit/theme";
import { Explorer } from "./explorer";
import { EditorPanel, ProblemsPanel, TerminalPanel } from "./panels";
import { WorkbenchTabSet } from "./tabs";
import {
    createWorkspace,
    defaultLayout,
    editorData,
    forgetLayout,
    openFile,
    restoreModel,
    saveLayout,
    type Types,
} from "./workspace";

// A code-editor workbench. The explorer (a left border) and the terminal and problems (a bottom
// border) are borders around the editors; the explorer and the status bar change the layout with
// commands on the model (`model.run`); the tabs follow their content (a dot while modified);
// closing a modified tab is stopped by a middleware (`model.use`), whatever closed it (button,
// menu, Ctrl+Delete); and the layout is saved on every change (`model.subscribe`, `toJSON`) and
// restored on the next visit (`createModel`, which reports a stored layout that is not valid).

const BORDER_ICONS: Partial<
    Record<TabOf<Types>["component"], typeof FolderTree>
> = {
    explorer: FolderTree,
    terminal: SquareTerminal,
    problems: Bug,
};

/** A tab of a side border (the activity bar): its button shows only the icon, upright. */
function inSideBorder(model: Model<Types>, tab: TabOf<Types>) {
    const parent = model.parentOf(tab.id);
    return (
        parent?.type === "border" &&
        (parent.location === "left" || parent.location === "right")
    );
}

/**
 * The borders' look. The left border is an activity bar, as in VS Code: an upright icon per tab,
 * named by `aria-label` and a tooltip (the kit's vertical labels are replaced). The bottom border's
 * tabs keep their icon and name.
 */
function borderOptions(
    model: Model<Types>,
    popupTheme: ReturnType<typeof usePopupTheme>,
): BorderOptions<Types> {
    return {
        renderBorderTab: (tab) => {
            const Icon = BORDER_ICONS[tab.component];
            const icon = Icon ? (
                <Icon aria-hidden="true" className="size-4 shrink-0" />
            ) : null;
            if (!inSideBorder(model, tab)) {
                return (
                    <>
                        {icon}
                        {tab.data.name}
                    </>
                );
            }
            return (
                <Tooltip.Root>
                    <Tooltip.Trigger
                        render={<span />}
                        className="grid place-items-center"
                    >
                        {icon}
                    </Tooltip.Trigger>
                    <Tooltip.Content {...popupTheme}>
                        {tab.data.name}
                    </Tooltip.Content>
                </Tooltip.Root>
            );
        },
        // upright and centred: no writing-mode, no rotation
        borderTabClassName: (tab) =>
            inSideBorder(model, tab) ? "justify-center p-2" : undefined,
        borderTabLabel: (tab) =>
            inSideBorder(model, tab) ? tab.data.name : undefined,
        // the bar is as wide as its icon buttons
        borderClassName: (border) =>
            border.location === "left" || border.location === "right"
                ? "data-[orientation=vertical]:w-10"
                : undefined,
    };
}

export default function IdeWorkbench() {
    const [workspace] = useState(createWorkspace);
    // the model, restored from storage; `problem` says why a stored layout was not used
    const [restored] = useState(restoreModel);
    const { model } = restored;
    const [problem, setProblem] = useState(restored.problem);
    const [, setRevision] = useState(0);
    // tabs waiting for an answer to "save changes?", and the ones already answered
    const [pending, setPending] = useState<string[]>([]);
    const confirmed = useRef(new Set<string>());
    const container = useRef<HTMLDivElement | null>(null);
    const popupTheme = usePopupTheme(container);
    const borders = borderOptions(model, popupTheme);

    // The policy: closing a modified editor asks first. The middleware sees every `tab.close`,
    // from any button, menu or key; it vetoes the close and queues the question, and the dialog
    // runs the close again once answered. A dry run (`model.can`, which decides whether the close
    // button and shortcut are offered) passes: the tab may close, after the question.
    useEffect(
        () =>
            model.use((ctx, next) => {
                if (ctx.command !== "tab.close" || ctx.dryRun) {
                    return next();
                }
                const id = ctx.payload.tab;
                if (!editorData(ctx.get(id))?.dirty) {
                    return next();
                }
                if (confirmed.current.delete(id)) {
                    return next();
                }
                setPending((ids) => (ids.includes(id) ? ids : [...ids, id]));
                return veto("the file has unsaved changes");
            }),
        [model],
    );

    // every change is saved, and re-renders what reads the model outside the layout
    useEffect(
        () =>
            model.subscribe(() => {
                saveLayout(model);
                setRevision((n) => n + 1); // the explorer and status bar read the model
            }),
        [model],
    );

    const open = (path: string) => openFile(model, path);

    // the same model loads the default layout: open editors keep their content
    const resetLayout = () => {
        forgetLayout();
        setProblem(undefined);
        model.run("layout.load", { layout: defaultLayout });
    };

    // answer the first pending question
    const pendingData = pending[0]
        ? editorData(model.get(pending[0]))
        : undefined;
    const answer = (choice: "save" | "discard" | "cancel") => {
        const id = pending[0];
        setPending((ids) => ids.slice(1));
        if (!id || !pendingData || choice === "cancel") return;
        if (choice === "save") workspace.save(pendingData.path);
        else workspace.discard(pendingData.path);
        confirmed.current.add(id);
        model.run("tab.close", { tab: id });
    };

    // what the explorer and the status bar show, read from the model
    const dirtyPaths = new Set<string>();
    for (const tab of model.tabs()) {
        const data = editorData(tab);
        if (data?.dirty) dirtyPaths.add(data.path);
    }
    const activeTabset = model.activeTabset();
    const activePath = activeTabset
        ? editorData(model.selectedTab(activeTabset.id))?.path
        : undefined;

    const renderContent = (tab: TabOf<Types>) => {
        switch (tab.component) {
            case "editor":
                return <EditorPanel tab={tab} workspace={workspace} />;
            case "terminal":
                return <TerminalPanel workspace={workspace} />;
            case "problems":
                return <ProblemsPanel onOpen={open} />;
            case "explorer":
                return (
                    <Explorer
                        activePath={activePath}
                        dirtyPaths={dirtyPaths}
                        onOpen={open}
                        onResetLayout={resetLayout}
                    />
                );
        }
    };

    return (
        <div
            ref={container}
            className="flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)"
        >
            {problem ? (
                <div
                    role="alert"
                    data-testid="restore-problem"
                    className="palette-orange flex shrink-0 items-start gap-3 border-b border-palette-line bg-palette-soft px-3 py-2 text-xs text-palette-contrast"
                >
                    <div className="min-w-0 flex-1">
                        <p>
                            The saved layout could not be restored, so the
                            default one is shown: {problem.message}
                        </p>
                        {problem.issues.length > 0 ? (
                            <ul className="mt-1 font-mono">
                                {problem.issues.map((issue) => (
                                    <li key={`${issue.path} ${issue.message}`}>
                                        {`${issue.path || "/"}: ${issue.message}`}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={() => setProblem(undefined)}
                        className="h-5 shrink-0 rounded-sm px-2 outline-none hover:bg-palette-base focus-visible:ring-1 focus-visible:ring-palette-ring"
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}
            {/* hairline splitters with a wider grab area, whatever the theme */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col [--dk-splitter-grab:7px] [--dk-splitter-size:1px]">
                <DockLayout
                    model={model}
                    renderTabSet={(node) => <WorkbenchTabSet node={node} />}
                    borders={borders}
                    renderContent={renderContent}
                />
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
                open={pendingData !== undefined}
                onOpenChange={(isOpen) => {
                    if (!isOpen) answer("cancel");
                }}
            >
                <AlertDialog.Portal>
                    <AlertDialog.Backdrop />
                    <AlertDialog.Content {...popupTheme}>
                        <AlertDialog.Header>
                            <AlertDialog.Title>
                                {`Save changes to ${pendingData?.name ?? ""}?`}
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
