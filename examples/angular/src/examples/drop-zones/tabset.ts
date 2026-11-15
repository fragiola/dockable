import { Component, input } from "@angular/core";
import { DOCKABLE, type TabsetNode } from "@fragiola/dockable-angular";
import type { Types } from "./index";
import * as styles from "./styles";

/** A tabset, the same in the page and in a popout window. */
@Component({
    selector: "example-drop-zones-tabset",
    imports: [DOCKABLE],
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
            </div>
            <div dockableTabSetContent></div>
        </div>
    `,
})
export class ZonesTabSet {
    readonly node = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
}
