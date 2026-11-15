import { Component, ElementRef, effect, inject, input } from "@angular/core";
import {
    DOCKABLE,
    injectDockable,
    injectModelState,
    injectTabOverflow,
    type TabOf,
} from "@fragiola/dockable-angular";
import { SELECT_PARTS } from "#/components/ui/select";
import type { Types } from "./index";
import * as styles from "./styles";

/**
 * The tabs that do not fit, listed in a select whose trigger is the package's overflow trigger.
 * The select never holds a value (`null`): picking a tab selects it in the model.
 */
@Component({
    selector: "example-hidden-tabs-select",
    imports: [DOCKABLE, SELECT_PARTS],
    host: { class: "contents" },
    template: `
        <!-- the package's trigger (measured), made the select's trigger; rendered only while tabs
             are hidden -->
        @if (overflow.hiddenTabs().length > 0) {
            <button
                dockableTabOverflowTrigger
                [kitSelectTrigger]="list"
                [value]="null"
                (valueChange)="pick($event)"
                [attr.aria-label]="overflow.hiddenTabs().length + ' more tabs'"
                [class]="styles.overflowTrigger"
            >{{ "+" + overflow.hiddenTabs().length }}</button>
        }
        <ng-template #list>
            <div kitSelectContent>
                @for (tab of overflow.hiddenTabs(); track tab.id) {
                    <div [kitSelectItem]="tab.id">{{ tab.label }}</div>
                }
            </div>
        </ng-template>
    `,
})
export class OverflowSelect {
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    protected readonly overflow = injectTabOverflow<Types>();

    protected pick(id: unknown) {
        if (typeof id === "string") {
            this.dockable.model().run("tab.select", { tabId: id });
        }
    }
}

/** A tab of a scrolling strip: scrolls itself into view when it becomes the selected one. */
@Component({
    selector: "[exampleScrollingTab]",
    template: "<ng-content />",
})
export class ScrollingTab {
    /** The tab of the `[dockableTab]` element this is on. */
    readonly tab = input.required<TabOf<Types>>({ alias: "dockableTab" });
    private readonly selected = injectModelState<Types, boolean>((_, model) =>
        model.is("tab-selected", { tabId: this.tab().id }),
    );

    constructor() {
        const element: HTMLElement = inject(ElementRef).nativeElement;
        effect(() => {
            if (this.selected()) {
                element.scrollIntoView({ block: "nearest", inline: "nearest" });
            }
        });
    }
}
