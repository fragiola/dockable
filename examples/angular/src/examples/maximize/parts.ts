import { Component, effect, input } from "@angular/core";
import {
    injectDockable,
    injectModelState,
    type Model,
    type TabsetNode,
} from "@fragiola/dockable-angular";
import { LucideMaximize2, LucideMinimize2 } from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/** Maximizes the tabset, or restores the layout when it is the maximized one. */
export function toggleMaximize(model: Model<Types>, tabsetId: string) {
    model.run("tabset.maximize", {
        tabsetId,
        value: !model.is("tabset-maximized", { tabsetId }),
    });
}

@Component({
    selector: "example-maximize-button",
    imports: [LucideMaximize2, LucideMinimize2],
    host: { class: "contents" },
    template: `
        <!-- the model answers without running the command (a tabset alone in its layout cannot
             maximize) -->
        @if (canMaximize()) {
            <button
                type="button"
                [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'"
                [attr.aria-pressed]="maximized()"
                [class]="styles.button"
                (click)="toggle()"
            >
                @if (maximized()) {
                    <svg lucideMinimize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                } @else {
                    <svg lucideMaximize2 aria-hidden="true" [class]="styles.buttonIcon"></svg>
                }
            </button>
        }
    `,
})
export class MaximizeButton {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    protected readonly maximized = injectModelState<Types, boolean>(
        (_, model) =>
            model.is("tabset-maximized", { tabsetId: this.tabset().id }),
    );
    protected readonly canMaximize = injectModelState<Types, boolean>(
        (_, model) =>
            model.can("tabset.maximize", {
                tabsetId: this.tabset().id,
                value: true,
            }),
    );

    protected toggle() {
        toggleMaximize(this.dockable.model(), this.tabset().id);
    }
}

/** Escape restores the maximized tabset, from anywhere in the page. It renders nothing. */
@Component({ selector: "example-restore-on-escape", template: "" })
export class RestoreOnEscape {
    private readonly dockable = injectDockable<Types>();

    constructor() {
        effect((onCleanup) => {
            const model = this.dockable.model();
            const layoutId = this.dockable.layoutId();
            const doc = this.dockable.engine().get("owner-document");
            if (!doc) {
                return;
            }
            const onKeyDown = (event: KeyboardEvent) => {
                const maximized = model.get("maximized-tabset", { layoutId });
                if (
                    event.key === "Escape" &&
                    !event.defaultPrevented &&
                    maximized
                ) {
                    model.run("tabset.maximize", {
                        tabsetId: maximized.id,
                        value: false,
                    });
                }
            };
            doc.addEventListener("keydown", onKeyDown);
            onCleanup(() => doc.removeEventListener("keydown", onKeyDown));
        });
    }
}
