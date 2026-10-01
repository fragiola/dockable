"use client";

import {
    type BorderNode,
    type RowNode,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable";
import { Dockable } from "@fragiola/dockable-react";
import { Bug, FolderTree, GitBranch, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { AlertDialog } from "#/components/ui/alert-dialog";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";
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

    // every change is saved (a drag's transient steps once, at its end), and re-renders what
    // reads the model outside the layout
    useEffect(
        () =>
            model.subscribe((event) => {
                if (event.transient) {
                    return;
                }
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
        <div className="flex min-h-0 flex-1 flex-col font-(family-name:--dk-font)">
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
                <div className="flex min-h-0 flex-1 flex-col p-(--dk-gap)">
                    <Dockable.Root
                        model={model}
                        className="palette-surface min-h-0 flex-1 bg-palette-base font-(family-name:--dk-font) text-palette-contrast"
                    >
                        {/* the borders around the editors: a strip of tabs on each side that has
                            some, and the area where the selected tab's panel opens */}
                        <Dockable.Borders<Types>
                            renderBar={(border) => <Border node={border} />}
                            renderContent={(border) => (
                                <BorderContent node={border} />
                            )}
                        >
                            <Dockable.Row<Types>
                                renderSplitter={(props) => (
                                    <Splitter {...props} />
                                )}
                            >
                                {renderNode}
                            </Dockable.Row>
                        </Dockable.Borders>
                        {/* every tab's content, editors and border panels alike */}
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    // panels sit in a layer above the tabsets, whose overflow
                                    // cannot clip them: the panel repeats the tabset's inner
                                    // radius on its corners
                                    className="palette-raised overflow-auto rounded-b-[max(0px,calc(var(--dk-radius)-var(--dk-border)))] bg-palette-base bg-(image:--dk-panel-texture) text-palette-contrast"
                                >
                                    {renderContent(tab)}
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        {/* Panels are portalled into the root after the indicator: it needs a
                            stacking order to paint above them. */}
                        <Dockable.DropIndicator
                            className={(state) =>
                                cn(
                                    "z-20 rounded-(--dk-radius) border-2 [border-style:var(--dk-indicator-style)] border-palette-base transition-[left,top,width,height]",
                                    state.kind === "edge"
                                        ? "palette-orange bg-palette-base/25"
                                        : "palette-blue bg-palette-base/20",
                                )
                            }
                            style={(state) => ({
                                transitionDuration: `${state.tabDragSpeed}s`,
                            })}
                        />
                    </Dockable.Root>
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
                open={pendingData !== undefined}
                onOpenChange={(isOpen) => {
                    if (!isOpen) answer("cancel");
                }}
            >
                <AlertDialog.Portal>
                    <AlertDialog.Backdrop />
                    <AlertDialog.Content>
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

/** A row's child: a tabset, or a nested row rendered by this same function. */
function renderNode(node: TabsetNode<Types> | RowNode<Types>) {
    if (node.type === "row") {
        return (
            <Dockable.Row
                node={node}
                renderSplitter={(props) => <Splitter {...props} />}
            >
                {renderNode}
            </Dockable.Row>
        );
    }
    return <WorkbenchTabSet node={node} />;
}

const BORDER_ICONS: Partial<
    Record<TabOf<Types>["component"], typeof FolderTree>
> = {
    explorer: FolderTree,
    terminal: SquareTerminal,
    problems: Bug,
};

/**
 * A border's strip. The left border is an activity bar, as in VS Code: an upright icon per tab,
 * named by `aria-label` and a tooltip, in a bar as wide as its icon buttons. The bottom border's
 * tabs keep their icon and name.
 */
function Border({ node }: { node: BorderNode<Types> }) {
    const side = node.location === "left" || node.location === "right";
    return (
        <Dockable.Border
            node={node}
            className={cn(
                "palette-surface shrink-0 bg-palette-base text-palette-contrast",
                // a side bar is as wide as its icon buttons
                "data-[orientation=vertical]:w-10 data-[orientation=horizontal]:h-(--dk-tab-height)",
                "data-[location=left]:border-e data-[location=right]:border-s data-[location=top]:border-b data-[location=bottom]:border-t border-palette-line",
                "data-drop-target:bg-palette-soft",
            )}
        >
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className="flex min-h-0 min-w-0 flex-1 gap-(--dk-tab-gap) p-1 data-[orientation=vertical]:flex-col"
            >
                {(tab) => {
                    const Icon = BORDER_ICONS[tab.component];
                    const icon = Icon ? (
                        <Icon aria-hidden="true" className="size-4 shrink-0" />
                    ) : null;
                    return (
                        <Dockable.Tab
                            node={tab}
                            // an icon-only tab is named by its tab's name
                            aria-label={side ? tab.data.name : undefined}
                            className={cn(
                                "flex shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-sm",
                                "font-(family-name:--dk-tab-font) text-(length:--dk-tab-size) text-palette-accent/85",
                                "outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-inset",
                                "data-selected:bg-palette-soft data-selected:text-palette-contrast data-dragging:opacity-40",
                                // upright and centred in a side bar: no writing-mode, no rotation
                                side ? "justify-center p-2" : "px-2 py-1",
                            )}
                        >
                            {side ? (
                                <Tooltip.Root>
                                    <Tooltip.Trigger
                                        render={<span />}
                                        className="grid place-items-center"
                                    >
                                        {icon}
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>
                                        {tab.data.name}
                                    </Tooltip.Content>
                                </Tooltip.Root>
                            ) : (
                                <>
                                    {icon}
                                    {tab.data.name}
                                </>
                            )}
                        </Dockable.Tab>
                    );
                }}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

/**
 * Where a border's panel opens, with its splitter on the layout's side. An overlay border paints
 * over the layout, so it gets a stacking order (above the tabsets and their splitters), a shadow
 * and a line on the side facing the layout.
 */
function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={cn(
                "data-overlay:z-30 data-overlay:shadow-xl data-overlay:border-palette-line",
                "data-overlay:data-[location=left]:border-e data-overlay:data-[location=right]:border-s",
                "data-overlay:data-[location=top]:border-b data-overlay:data-[location=bottom]:border-t",
            )}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

/**
 * The bar between two children of a row, or between a border's panel and the layout:
 * `--dk-splitter-size` thick (the engine measures it), with a wider grab area (`::after`) and a
 * grip for the themes that show one (`--dk-grip`).
 */
function Splitter({
    node,
    index,
}: {
    node: RowNode<Types> | BorderNode<Types>;
    index?: number;
}) {
    return (
        <Dockable.Splitter
            node={node}
            index={index}
            aria-label="Resize"
            className={cn(
                "group/splitter relative z-10 flex shrink-0 items-center justify-center bg-(--dk-splitter-bg) outline-none",
                "after:absolute after:transition-colors after:duration-(--dk-motion)",
                "hover:after:bg-palette-ring/30 data-dragging:after:bg-palette-ring/60 focus-visible:after:bg-palette-ring/60",
                // side by side: a vertical bar
                "data-[orientation=vertical]:w-(--dk-splitter-size) data-[orientation=vertical]:cursor-ew-resize",
                "data-[orientation=vertical]:after:inset-y-0 data-[orientation=vertical]:after:start-1/2",
                "data-[orientation=vertical]:after:w-(--dk-splitter-grab) data-[orientation=vertical]:after:-translate-x-1/2",
                "rtl:data-[orientation=vertical]:after:translate-x-1/2",
                // stacked: a horizontal bar
                "data-[orientation=horizontal]:h-(--dk-splitter-size) data-[orientation=horizontal]:cursor-ns-resize",
                "data-[orientation=horizontal]:after:inset-x-0 data-[orientation=horizontal]:after:top-1/2",
                "data-[orientation=horizontal]:after:h-(--dk-splitter-grab) data-[orientation=horizontal]:after:-translate-y-1/2",
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    "pointer-events-none [display:var(--dk-grip)] rounded-full bg-palette-line",
                    "group-data-[orientation=vertical]/splitter:h-8 group-data-[orientation=vertical]/splitter:w-1",
                    "group-data-[orientation=horizontal]/splitter:h-1 group-data-[orientation=horizontal]/splitter:w-8",
                )}
            />
        </Dockable.Splitter>
    );
}
