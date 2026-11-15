import { Component, input } from "@angular/core";
import {
    DOCKABLE,
    injectModelState,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { LucideMonitorDown, LucideMonitorUp } from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/**
 * A tabset: its strip of tabs and its screen button on top, the measured content area below. A
 * component, so it reads the layout it is rendered in (the main one, or a window's).
 *
 * The screen button, in the main layout, sends the whole tabset to a window; in a window, it
 * brings its selected tab back to the main screen.
 */
@Component({
    selector: "example-multi-monitor-tabset",
    imports: [DOCKABLE, LucideMonitorDown, LucideMonitorUp],
    host: { class: "contents" },
    template: `
        <div [dockableTabSet]="node()" [class]="styles.tabset">
            <div [class]="styles.strip">
                <div
                    dockableTabList
                    [attr.aria-label]="node().data?.name || 'Tabs'"
                    [class]="styles.tabList"
                >
                    <ng-template dockableTabListItem let-tab>
                        <div [dockableTab]="tab" [class]="styles.tab">
                            <span [class]="styles.tabName">{{ tab.label }}</span>
                        </div>
                    </ng-template>
                </div>
                <div [class]="styles.tabsetActions">
                    @if (inWindow()) {
                        <button
                            dockablePopoutTrigger
                            aria-label="Back to the main screen"
                            data-testid="back"
                            [class]="styles.screenButton"
                        >
                            <svg lucideMonitorDown aria-hidden="true" [class]="styles.actionIcon"></svg>
                        </button>
                    } @else {
                        <button
                            dockablePopoutTrigger
                            target="tabset"
                            [attr.aria-label]="'Move ' + (node().data?.name ?? 'panel') + ' to another screen'"
                            data-testid="move-tabset"
                            [class]="styles.screenButton"
                        >
                            <svg lucideMonitorUp aria-hidden="true" [class]="styles.actionIcon"></svg>
                        </button>
                    }
                </div>
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class MonitorTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly inWindow = injectModelState<Types, boolean>(
        (_state, model) =>
            model.is("node-in-window", { nodeId: this.node().id }),
    );
}
