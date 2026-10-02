"use client";

import {
    type BorderNode,
    Dockable,
    type Model,
    type RowNode,
    type TabOf,
    type TabsetNode,
    useModelState,
    veto,
} from "@fragiola/dockable-react";
import { Bug, FolderTree, GitBranch, SquareTerminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import { AlertDialog } from "#/components/ui/alert-dialog";
import { Tooltip } from "#/components/ui/tooltip";
import { Explorer } from "./explorer";
import { EditorPanel, ProblemsPanel, TerminalPanel } from "./panels";
import * as styles from "./styles";
import { WorkbenchTabSet } from "./tabs";
import {
    activePath,
    createWorkspace,
    defaultLayout,
    dirtyPaths,
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
                const id = ctx.payload.tabId;
                if (!editorData(ctx.get("node-by", { id }))?.dirty) {
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

    // every change is saved (a drag's transient steps once, at its end)
    useEffect(
        () =>
            model.subscribe((event) => {
                if (!event.transient) saveLayout(model);
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
    const pendingNode = pending[0]
        ? model.get("node-by", { id: pending[0] })
        : undefined;
    const pendingData = editorData(pendingNode);
    const answer = (choice: "save" | "discard" | "cancel") => {
        const id = pending[0];
        setPending((ids) => ids.slice(1));
        if (!id || !pendingData || choice === "cancel") return;
        if (choice === "save") workspace.save(pendingData.path);
        else workspace.discard(pendingData.path);
        confirmed.current.add(id);
        model.run("tab.close", { tabId: id });
    };

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
                        model={model}
                        onOpen={open}
                        onResetLayout={resetLayout}
                    />
                );
        }
    };

    return (
        <div className={styles.workbench}>
            {problem ? (
                <div
                    role="alert"
                    data-testid="restore-problem"
                    className={styles.restoreProblem}
                >
                    <div className={styles.restoreProblemBody}>
                        <p>
                            The saved layout could not be restored, so the
                            default one is shown: {problem.message}
                        </p>
                        {problem.issues.length > 0 ? (
                            <ul className={styles.restoreProblemIssues}>
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
                        className={styles.restoreProblemDismiss}
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}
            {/* hairline splitters with a wider grab area, whatever the theme */}
            <div className={styles.stage}>
                <div className={styles.frame}>
                    <Dockable.Root model={model} className={styles.root}>
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
                        <Dockable.Panels<Types>>
                            {(tab) => (
                                <Dockable.Panel
                                    node={tab}
                                    className={styles.panel}
                                >
                                    {renderContent(tab)}
                                </Dockable.Panel>
                            )}
                        </Dockable.Panels>
                        <Dockable.DropIndicator
                            className={styles.dropIndicator}
                        />
                    </Dockable.Root>
                </div>
            </div>

            <StatusBar model={model} />

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
                                {`Save changes to ${pendingNode?.type === "tab" ? pendingNode.label : ""}?`}
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
                                className={styles.saveButton}
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

/** The status bar follows the model: a commit re-renders it, not the layout. */
function StatusBar({ model }: { model: Model<Types> }) {
    const unsaved = useModelState(() => dirtyPaths(model).size, { model });
    const path = useModelState(() => activePath(model), { model });
    return (
        <footer className={styles.statusBar}>
            <span className={styles.statusBranch}>
                <GitBranch
                    aria-hidden="true"
                    className={styles.statusBranchIcon}
                />
                main
            </span>
            <span data-testid="unsaved-count">
                {unsaved === 1 ? "1 unsaved file" : `${unsaved} unsaved files`}
            </span>
            <span className={styles.statusPath}>{path ?? ""}</span>
        </footer>
    );
}

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
        <Dockable.Border node={node} className={styles.border}>
            <Dockable.TabList<Types>
                aria-label={`${node.location} panels`}
                className={styles.borderTabList}
            >
                {(tab) => {
                    const Icon = BORDER_ICONS[tab.component];
                    const icon = Icon ? (
                        <Icon
                            aria-hidden="true"
                            className={styles.borderTabIcon}
                        />
                    ) : null;
                    return (
                        <Dockable.Tab
                            node={tab}
                            // an icon-only tab is named by its tab's name
                            aria-label={side ? tab.label : undefined}
                            // upright and centred in a side bar
                            className={styles.borderTab(side)}
                        >
                            {side ? (
                                <Tooltip.Root>
                                    <Tooltip.Trigger
                                        render={<span />}
                                        className={styles.borderTabTooltip}
                                    >
                                        {icon}
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>
                                        {tab.label}
                                    </Tooltip.Content>
                                </Tooltip.Root>
                            ) : (
                                <>
                                    {icon}
                                    {tab.label}
                                </>
                            )}
                        </Dockable.Tab>
                    );
                }}
            </Dockable.TabList>
        </Dockable.Border>
    );
}

function BorderContent({ node }: { node: BorderNode<Types> }) {
    return (
        <Dockable.BorderContent
            node={node}
            className={styles.borderContent}
            renderSplitter={(border) => <Splitter node={border} />}
        />
    );
}

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
            className={styles.splitter}
        >
            <span aria-hidden="true" className={styles.splitterGrip} />
        </Dockable.Splitter>
    );
}
