import { Component, computed, input } from "@angular/core";
import {
    DOCKABLE,
    injectDockable,
    injectModelState,
    injectTabOverflow,
    type Model,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideBug,
    LucideMaximize2,
    LucideMinimize2,
    LucideSquareTerminal,
    LucideX,
} from "@lucide/angular";
import { CONTEXT_MENU } from "#/components/ui/context-menu";
import { SELECT_PARTS } from "#/components/ui/select";
import { FileIcon } from "./explorer";
import * as styles from "./styles";
import { editorData, type Types } from "./workspace";

// The workbench's tabset: file tabs with an icon, a dirty dot and a close button, a context
// menu per tab, a Select listing the tabs that no longer fit (tab overflow hides them; the selected
// one always stays), and a maximize button.
// Everything is a consumer choice made of Dockable primitives, commands and data-*.

/** Whether a tab may be closed at all (its `closable`, else the layout default). */
function closable(model: Model<Types>, tab: TabOf<Types>) {
    return model.get("tab-settings-by", { tabId: tab.id })?.closable === true;
}

function closeAll(model: Model<Types>, tabs: readonly TabOf<Types>[]) {
    for (const tab of tabs) {
        if (closable(model, tab)) {
            // one command per tab: the workbench's middleware can still stop the dirty ones
            model.run("tab.close", { tabId: tab.id });
        }
    }
}

@Component({
    selector: "example-ide-tabset",
    imports: [
        DOCKABLE,
        CONTEXT_MENU,
        SELECT_PARTS,
        FileIcon,
        LucideBug,
        LucideMaximize2,
        LucideMinimize2,
        LucideSquareTerminal,
        LucideX,
    ],
    host: { class: "contents" },
    template: `
        <div [dockableTabSet]="node()" [class]="styles.tabset">
            <div [class]="styles.strip">
                <div
                    dockableTabList
                    [attr.aria-label]="node().id === 'panel' ? 'Panel' : 'Editors'"
                    [class]="styles.tabList"
                >
                    <ng-template [dockableTabListItem]="model()" let-tab>
                        <!-- the tab is the context menu's trigger: the directive goes on the tab -->
                        <div
                            [dockableTab]="tab"
                            [kitContextMenuTrigger]="menu"
                            [attr.data-dirty]="isDirty(tab) ? '' : null"
                            [class]="styles.tab"
                        >
                            @switch (tab.component) {
                                @case ("editor") {
                                    <example-ide-file-icon [path]="tab.data.path" />
                                }
                                @case ("terminal") {
                                    <svg lucideSquareTerminal aria-hidden="true" [class]="styles.tabIcon"></svg>
                                }
                                @default {
                                    <svg lucideBug aria-hidden="true" [class]="styles.tabIcon"></svg>
                                }
                            }
                            <span [class]="styles.tabName">{{ tab.label }}</span>
                            @if (canClose(tab)) {
                                <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the
                                     keyboard; the press must not activate the tabset, and a click on
                                     the tab would select it -->
                                <button
                                    type="button"
                                    tabindex="-1"
                                    [attr.aria-label]="'Close ' + tab.label"
                                    data-testid="close-tab"
                                    [class]="styles.closeButton"
                                    (pointerdown)="$event.stopPropagation()"
                                    (click)="$event.stopPropagation(); close(tab)"
                                >
                                    <!-- VS Code's convention: a dot while modified, the cross on hover -->
                                    @if (isDirty(tab)) {
                                        <span data-testid="dirty-dot" [class]="styles.dirtyDot"></span>
                                    }
                                    <svg lucideX aria-hidden="true" [class]="styles.closeIcon(isDirty(tab))"></svg>
                                </button>
                            }
                        </div>
                        <ng-template #menu>
                            <div kitContextMenuContent>
                                <div kitContextMenuItem [disabled]="!canClose(tab)" (select)="close(tab)">
                                    Close
                                </div>
                                <div
                                    kitContextMenuItem
                                    [disabled]="siblings().length < 2"
                                    (select)="closeOthers(tab)"
                                >
                                    Close others
                                </div>
                                <div
                                    kitContextMenuItem
                                    [disabled]="isLast(tab)"
                                    (select)="closeToTheRight(tab)"
                                >
                                    Close to the right
                                </div>
                                <div kitContextMenuItem (select)="closeSaved()">Close saved</div>
                                <div kitContextMenuSeparator></div>
                                <!-- moving a tab to its own tabset's edge splits it off into a new
                                     tabset -->
                                <div
                                    kitContextMenuItem
                                    [disabled]="siblings().length < 2"
                                    (select)="split(tab, 'end')"
                                >
                                    Split right
                                </div>
                                <div
                                    kitContextMenuItem
                                    [disabled]="siblings().length < 2"
                                    (select)="split(tab, 'bottom')"
                                >
                                    Split down
                                </div>
                            </div>
                        </ng-template>
                    </ng-template>
                </div>
                <div [class]="styles.tabsetActions">
                    <!-- the tabs that do not fit, one click away (shown only while there are some) -->
                    <button
                        dockableTabOverflowTrigger
                        [kitSelectTrigger]="overflow"
                        [value]="null"
                        (valueChange)="selectTab($event)"
                        [attr.aria-label]="overflowTabs().length + ' more tabs'"
                        data-testid="overflow-select"
                        [class]="styles.overflowTrigger"
                    >
                        {{ "+" + overflowTabs().length }}
                    </button>
                    <ng-template #overflow>
                        <div kitSelectContent>
                            @for (tab of overflowTabs(); track tab.id) {
                                <div [kitSelectItem]="tab.id">{{ tab.label }}</div>
                            }
                        </div>
                    </ng-template>
                    <button
                        type="button"
                        [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'"
                        [attr.aria-pressed]="maximized()"
                        [class]="styles.maximizeButton"
                        (click)="toggleMaximized()"
                    >
                        @if (maximized()) {
                            <svg lucideMinimize2 aria-hidden="true" [class]="styles.maximizeIcon"></svg>
                        } @else {
                            <svg lucideMaximize2 aria-hidden="true" [class]="styles.maximizeIcon"></svg>
                        }
                    </button>
                </div>
            </div>
            <!-- the content area renders nothing of its own: the empty state goes in it -->
            <div dockableTabSetContent>
                @if (node().children.length === 0) {
                    <p [class]="styles.emptyState">Open a file from the explorer.</p>
                }
            </div>
        </div>
    `,
})
export class WorkbenchTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly model = injectDockable<Types>().model;
    protected readonly overflowTabs = injectTabOverflow<Types>(() =>
        this.node(),
    ).hiddenTabs;
    protected readonly maximized = injectModelState<Types, boolean>(
        (_state, model) =>
            model.is("tabset-maximized", { tabsetId: this.node().id }),
    );
    protected readonly siblings = computed(() => this.node().children);

    protected isDirty(tab: TabOf<Types>) {
        return editorData(tab)?.dirty === true;
    }

    protected canClose(tab: TabOf<Types>) {
        return closable(this.model(), tab);
    }

    protected isLast(tab: TabOf<Types>) {
        const siblings = this.siblings();
        return siblings.at(-1)?.id === tab.id;
    }

    protected close(tab: TabOf<Types>) {
        this.model().run("tab.close", { tabId: tab.id });
    }

    protected closeOthers(tab: TabOf<Types>) {
        closeAll(
            this.model(),
            this.siblings().filter((other) => other.id !== tab.id),
        );
    }

    protected closeToTheRight(tab: TabOf<Types>) {
        const siblings = this.siblings();
        const index = siblings.findIndex((other) => other.id === tab.id);
        closeAll(this.model(), siblings.slice(index + 1));
    }

    protected closeSaved() {
        closeAll(
            this.model(),
            this.siblings().filter(
                (other) => editorData(other)?.dirty !== true,
            ),
        );
    }

    protected split(tab: TabOf<Types>, location: "end" | "bottom") {
        this.model().run("tab.move", {
            tabId: tab.id,
            to: this.node().id,
            location,
        });
    }

    protected selectTab(id: unknown) {
        if (typeof id === "string") {
            this.model().run("tab.select", { tabId: id });
        }
    }

    protected toggleMaximized() {
        this.model().run("tabset.maximize", {
            tabsetId: this.node().id,
            value: !this.maximized(),
        });
    }
}
