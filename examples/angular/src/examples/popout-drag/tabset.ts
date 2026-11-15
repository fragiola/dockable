import { Component, input } from "@angular/core";
import { DOCKABLE, type TabsetNode } from "@fragiola/dockable-angular";
import {
    LucideAppWindow,
    LucideArrowDownToLine,
    LucideSquareArrowOutUpRight,
} from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/**
 * A tabset: a card with the strip of tabs and its window buttons on top, and the measured content
 * area below. A component, so it reads the layout it is rendered in (the main one, or a popout
 * window's).
 */
@Component({
    selector: "example-popout-drag-tabset",
    imports: [
        DOCKABLE,
        LucideAppWindow,
        LucideArrowDownToLine,
        LucideSquareArrowOutUpRight,
    ],
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
                <!-- Two triggers: the selected tab, and the whole tabset. Each docks
                     back from a window. -->
                <div [class]="styles.tabsetActions">
                    <button
                        dockablePopoutTrigger
                        #tabTrigger="dockablePopoutTrigger"
                        data-testid="popout-tab"
                        [attr.aria-label]="
                            tabTrigger.state()?.mode === 'dock'
                                ? 'Dock the tab back'
                                : 'Pop out the tab'
                        "
                        [class]="styles.windowButton"
                    >
                        <svg lucideSquareArrowOutUpRight aria-hidden="true" [class]="styles.popoutIcon"></svg>
                        <svg lucideArrowDownToLine aria-hidden="true" [class]="styles.dockIcon"></svg>
                    </button>
                    <!-- one trigger per tabset is enough in a window: the tab trigger
                         docks back -->
                    @if (node().children.length > 1) {
                        <button
                            dockablePopoutTrigger
                            target="tabset"
                            #tabsetTrigger="dockablePopoutTrigger"
                            data-testid="popout-tabset"
                            [attr.aria-label]="
                                tabsetTrigger.state()?.mode === 'dock'
                                    ? 'Dock the whole tabset back'
                                    : 'Pop out the whole tabset'
                            "
                            [class]="styles.tabsetWindowButton"
                        >
                            <svg lucideAppWindow aria-hidden="true" [class]="styles.tabsetIcon"></svg>
                        </button>
                    }
                </div>
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class PopoutDragTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
}
