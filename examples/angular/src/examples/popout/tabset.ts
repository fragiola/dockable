import { Component, computed, input } from "@angular/core";
import {
    DOCKABLE,
    injectDockable,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideArrowDownToLine,
    LucideSquareArrowOutUpRight,
} from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/**
 * A tabset: a card with the strip of tabs and its buttons on top, and the measured content area
 * below. A component, so it reads the layout it is rendered in (the main one, or a popout
 * window's).
 *
 * `[dockablePopoutTrigger]` pops the selected tab out and, in a popout, docks it back into the
 * main layout's active tabset. It is hidden when the tab cannot pop out (here "Pinned here"), and
 * says which way it goes with `data-mode` ("popout" or "dock"): the icons follow it.
 */
@Component({
    selector: "example-popout-tabset",
    imports: [DOCKABLE, LucideArrowDownToLine, LucideSquareArrowOutUpRight],
    host: { class: "contents" },
    template: `
        <div [dockableTabSet]="node()" [class]="styles.tabset">
            <div [class]="styles.strip">
                <div dockableTabList aria-label="Tabs" [class]="styles.tabList">
                    <ng-template dockableTabListItem let-tab>
                        <div [dockableTab]="tab" [class]="styles.tab">
                            <span [class]="styles.tabName">{{ tab.label }}</span>
                        </div>
                    </ng-template>
                </div>
                <div [class]="styles.tabsetButtons">
                    <button
                    dockablePopoutTrigger
                    #trigger="dockablePopoutTrigger"
                    [attr.aria-label]="
                        trigger.state()?.mode === 'dock' ? 'Dock ' + name() + ' back' : 'Pop out ' + name()
                    "
                    [class]="styles.popoutButton"
                >
                    <svg lucideSquareArrowOutUpRight aria-hidden="true" [class]="styles.popoutIcon"></svg>
                    <svg lucideArrowDownToLine aria-hidden="true" [class]="styles.dockIcon"></svg>
                </button>
                </div>
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class PopoutTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    // a new tabset node (another selected tab) computes it again
    protected readonly name = computed(
        () =>
            this.dockable
                .model()
                .get("selected-tab-by", { tabsetId: this.node().id })?.label ??
            "",
    );
}
