import { Component, signal } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
    MAIN_LAYOUT,
    type Middleware,
    type TabAddPayload,
    type TabJson,
    type TabOf,
    type TabsetNode,
    veto,
} from "@fragiola/dockable-angular";
import { LucideLock } from "@lucide/angular";
import { TOOLTIP } from "#/components/ui/tooltip";
import { PanelBody } from "../_kit/card";
import { DocPanel } from "./doc-panel";
import { CONSOLE, LOCKED, REFERENCE, type Types } from "./regions";
import * as styles from "./styles";

// Stop drops into part of the layout, in two layers:
//
// 1. A middleware (`model.use`) on the commands that place a tab or tabset: `tab.move`,
//    `tabset.move` and `tab.add`. Here the "Reference" tabset takes only tabs whose
//    `data.region` is "reference" (in its strip, its centre or its sides), and the layout's edge
//    beside a locked tabset refuses docking. It runs for every command, whoever issues it: a
//    drag asks it on every hover with `model.can` (a dry run, `ctx.dryRun`), so over a refused
//    target the outline hides, the browser shows its "not allowed" cursor, and the target
//    tabset and the root get `data-drop-refused`; a drop, or a command run from code, is vetoed
//    the same way. Each tabset styles its own `data-drop-refused`: the whole region turns red,
//    with a lock in its middle, for as long as the drag hovers it.
// 2. Node flags: the "Console" tabset has `droppable: false` (nothing merges into it) and
//    `splittable: false` (nothing splits it), and its tabs `draggable: false`.
//

const doc = (name: string, region: string): TabJson<Types> => ({
    component: "doc",
    label: name,
    data: { region },
});

const json: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: REFERENCE,
                data: { name: "Reference" },
                weight: 30,
                children: [
                    doc("Spec", "reference"),
                    doc("Glossary", "reference"),
                ],
            },
            {
                type: "tabset",
                id: "workspace",
                data: { name: "Workspace" },
                weight: 45,
                children: [
                    doc("Draft", "workspace"),
                    // belongs to the reference region: it may be dropped there
                    doc("API reference", "reference"),
                    doc("Notes", "workspace"),
                ],
            },
            {
                type: "tabset",
                id: CONSOLE,
                data: { name: "Console" },
                weight: 25,
                droppable: false,
                splittable: false,
                children: [
                    {
                        component: "console",
                        label: "Console",
                        draggable: false,
                    },
                    {
                        component: "console",
                        label: "Output",
                        draggable: false,
                    },
                ],
            },
        ],
    },
};

/** A tab's region: only documents have one. */
function regionOf(tab: TabOf<Types> | TabAddPayload<Types> | undefined) {
    return tab?.component === "doc" ? tab.data.region : undefined;
}

/**
 * The drop rule, as middleware. Ids are stable; paths (`/ts0`) change as the layout changes.
 * `ctx.command` narrows `ctx.payload`.
 */
const lockedRegions: Middleware<Types> = (ctx, next) => {
    // what is placed: an existing tab (tab.move), a new tab (tab.add) or a tabset (tabset.move)
    let tab: TabOf<Types> | TabAddPayload<Types> | undefined;
    if (ctx.command === "tab.move") {
        const moved = ctx.get("node-by", { id: ctx.payload.tabId });
        tab = moved?.type === "tab" ? moved : undefined;
    } else if (ctx.command === "tab.add") {
        tab = ctx.payload;
    } else if (ctx.command !== "tabset.move") {
        return next();
    }
    const { to, location } = ctx.payload;
    const name = tab ? `"${tab.label}"` : "a tabset";

    if (to === REFERENCE && regionOf(tab) !== REFERENCE) {
        return veto(`A middleware vetoed moving ${name} into Reference.`);
    }
    // docking at the layout's edge next to a locked tabset (`to` is the root row, or the layout)
    const target =
        to === MAIN_LAYOUT ? ctx.state.root : ctx.get("node-by", { id: to });
    if (target?.type === "row") {
        const children = target.children;
        const beside =
            location === "start"
                ? children[0]
                : location === "end"
                  ? children[children.length - 1]
                  : undefined;
        if (beside && LOCKED.has(beside.id)) {
            return veto(
                `A middleware vetoed docking ${name} beside a locked tabset.`,
            );
        }
    }
    return next();
};

@Component({
    selector: "example-locked-regions",
    imports: [DOCKABLE, TOOLTIP, LucideLock, PanelBody, DocPanel],
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            <svg lucideLock aria-hidden="true" [class]="styles.toolbarIcon"></svg>
            <p [class]="styles.toolbarHint">
                Reference takes reference tabs only; Console takes nothing.
            </p>
            <p role="status" [class]="styles.notice">{{ notice() }}</p>
        </div>
        <div [class]="styles.frame">
            <div [dockableRoot]="model" [class]="styles.root">
                <div dockableRow>
                    <ng-template [dockableRowChild]="model" let-node>
                        @if (node.type === "row") {
                            <div [dockableRow]="node"></div>
                        } @else {
                            <!-- A tabset: the strip of tabs and its lock on top, the measured
                                 content area below. -->
                            <div [dockableTabSet]="node" [class]="styles.tabset(LOCKED.has(node.id))">
                                <div [class]="styles.strip">
                                    <!-- a tabset created by a drop has no name of its own -->
                                    <div
                                        dockableTabList
                                        [attr.aria-label]="node.data?.name || 'Tabs'"
                                        [class]="styles.tabList"
                                    >
                                        <ng-template [dockableTabListItem]="model" let-tab>
                                            <div [dockableTab]="tab" [class]="styles.tab">
                                                <span [class]="styles.tabName">{{ tab.label }}</span>
                                            </div>
                                        </ng-template>
                                    </div>
                                    <div [class]="styles.tabsetActions">
                                        <!-- a lock on locked tabsets, with a Fragiola tooltip saying why -->
                                        @if (LOCKED.has(node.id)) {
                                            @let why = whyLocked(node);
                                            <button
                                                type="button"
                                                [kitTooltipTrigger]="tip"
                                                [attr.aria-label]="'Locked: ' + why"
                                                [class]="styles.lockBadge"
                                            >
                                                <svg lucideLock aria-hidden="true" [class]="styles.lockIcon"></svg>
                                            </button>
                                            <ng-template #tip><div kitTooltipContent>{{ why }}</div></ng-template>
                                        }
                                    </div>
                                </div>
                                <div dockableTabSetContent></div>
                                <!-- over the whole tabset (its strip and its panel) while it refuses the drag -->
                                <div aria-hidden="true" data-testid="refused-overlay" [class]="styles.refusedOverlay">
                                    <span [class]="styles.refusedBadge">
                                        <svg lucideLock [class]="styles.refusedIcon"></svg>
                                    </span>
                                    <span [class]="styles.refusedText">Not allowed here</span>
                                </div>
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
                            @case ("doc") {
                                <example-locked-regions-doc [tab]="tab" (notice)="notice.set($event)" />
                            }
                            @case ("console") {
                                <kit-panel-body [title]="tab.label">
                                    <p [class]="styles.panelText">
                                        Locked in place: this tab cannot be dragged, and nothing can
                                        be dropped into or beside it.
                                    </p>
                                </kit-panel-body>
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
export default class LockedRegions {
    protected readonly styles = styles;
    protected readonly LOCKED = LOCKED;
    // the rule is installed once, with the model: it guards every command from the start
    protected readonly model = (() => {
        const created = createModel<Types>(json);
        created.use(lockedRegions);
        return created;
    })();
    protected readonly notice = signal<string | undefined>(undefined);

    protected whyLocked(tabset: TabsetNode<Types>) {
        return tabset.id === REFERENCE
            ? "Only reference tabs can be dropped here"
            : "Nothing can be dropped here, and its tabs stay put";
    }
}
