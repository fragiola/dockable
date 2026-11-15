import { Component, computed, input } from "@angular/core";
import {
    injectDockable,
    injectModelState,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import {
    LucideCalendar,
    LucideDynamicIcon,
    LucideFileText,
    LucideHouse,
    type LucideIcon,
    LucideMail,
    LucidePin,
    LucidePinOff,
    LucideX,
} from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/** The icon a pinned tab shows, by its `data.icon`. */
const ICONS: Record<string, LucideIcon> = {
    home: LucideHouse,
    mail: LucideMail,
    calendar: LucideCalendar,
};

/** The inside of a tab: an icon when pinned (the name is kept for screen readers). */
@Component({
    selector: "[exampleTabLabel]",
    imports: [LucideDynamicIcon, LucideX],
    template: `
        @if (tab().pinned === true) {
            <svg [lucideIcon]="icon()" aria-hidden="true" [class]="styles.tabIcon"></svg>
            <span [class]="styles.tabNameHidden">{{ tab().label }}</span>
        } @else {
            <span [class]="styles.tabName">{{ tab().label }}</span>
            @if (closeable()) {
                <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the
                     press must not activate the tabset, and a click on the tab would select it -->
                <button
                    type="button"
                    tabindex="-1"
                    [attr.aria-label]="'Close ' + tab().label"
                    [class]="styles.closeButton"
                    (pointerdown)="$event.stopPropagation()"
                    (click)="$event.stopPropagation(); close()"
                >
                    <svg lucideX aria-hidden="true" [class]="styles.closeIcon"></svg>
                </button>
            }
        }
    `,
})
export class TabLabel {
    /** The tab of the `[dockableTab]` element this is on. */
    readonly tab = input.required<TabOf<Types>>({ alias: "dockableTab" });
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    protected readonly icon = computed(
        () => ICONS[this.tab().data.icon ?? ""] ?? LucideFileText,
    );
    protected readonly closeable = injectModelState<Types, boolean>(
        (_, model) => model.can("tab.close", { tabId: this.tab().id }),
    );

    protected close() {
        this.dockable.model().run("tab.close", { tabId: this.tab().id });
    }
}

/** Pins or unpins the tabset's selected tab. */
@Component({
    selector: "example-pin-button",
    imports: [LucidePin, LucidePinOff],
    host: { class: "contents" },
    template: `
        @if (selected(); as selected) {
            <button
                type="button"
                [attr.aria-label]="(selected.pinned ? 'Unpin ' : 'Pin ') + selected.label"
                [attr.aria-pressed]="selected.pinned === true"
                [class]="styles.button"
                (click)="toggle(selected)"
            >
                @if (selected.pinned) {
                    <svg lucidePinOff aria-hidden="true" [class]="styles.buttonIcon"></svg>
                } @else {
                    <svg lucidePin aria-hidden="true" [class]="styles.buttonIcon"></svg>
                }
            </button>
        }
    `,
})
export class PinButton {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    protected readonly selected = injectModelState<
        Types,
        TabOf<Types> | undefined
    >((_, model) =>
        model.get("selected-tab-by", { tabsetId: this.tabset().id }),
    );

    protected toggle(selected: TabOf<Types>) {
        this.dockable.model().run("tab.pin", {
            tabId: selected.id,
            value: selected.pinned !== true,
        });
    }
}
