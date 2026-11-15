import { Component, input } from "@angular/core";
import {
    injectDockable,
    injectModelState,
    type TabOf,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { LucideLock, LucideX } from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/** A tab's content with its own close button; the tab closes by a middle click too. */
@Component({
    selector: "[exampleClosableTab]",
    imports: [LucideLock, LucideX],
    host: { "(auxclick)": "onAuxClick($event)" },
    template: `
        <span [class]="styles.tabName">{{ tab().label }}</span>
        @if (closeable()) {
            <!-- the tab is the tab stop: Ctrl+Delete on it closes it from the keyboard; the press
                 must not activate the tabset, and a click on the tab would select it -->
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
        } @else {
            <svg lucideLock aria-hidden="true" [class]="styles.lockIcon"></svg>
        }
    `,
})
export class ClosableTab {
    /** The tab of the `[dockableTab]` element this is on. */
    readonly tab = input.required<TabOf<Types>>({ alias: "dockableTab" });
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    // whether `tab.close` would apply: the tab's `closable` (resolved against the layout
    // defaults), not pinned, and no middleware veto. A dry run: nothing changes. Asked again
    // whenever the model changes.
    protected readonly closeable = injectModelState<Types, boolean>(
        (_, model) => model.can("tab.close", { tabId: this.tab().id }),
    );

    protected close() {
        this.dockable.model().run("tab.close", { tabId: this.tab().id });
    }

    protected onAuxClick(event: MouseEvent) {
        if (event.button === 1 && this.closeable()) {
            event.preventDefault();
            this.close();
        }
    }
}

@Component({
    selector: "example-close-tabset-button",
    imports: [LucideX],
    host: { class: "contents" },
    template: `
        @if (tabset().children.length > 0) {
            <!-- closes every closeable tab; the tabset goes too once it is empty -->
            <button
                type="button"
                aria-label="Close tabset"
                [class]="styles.button"
                (click)="close()"
            >
                <svg lucideX aria-hidden="true" [class]="styles.buttonIcon"></svg>
            </button>
        }
    `,
})
export class CloseTabsetButton {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();

    protected close() {
        this.dockable
            .model()
            .run("tabset.close", { tabsetId: this.tabset().id });
    }
}
