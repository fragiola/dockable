import { Component, input, signal } from "@angular/core";
import { cn } from "#/lib/cn";

// Demo content, shared by the examples: a panel body, and a card with state you can see. Nothing
// here is part of Dockable: a panel renders whatever the consumer gives it.

/** A padded, scrollable panel body with a title (`<kit-panel-body title="…">`). */
@Component({
    selector: "kit-panel-body",
    host: { class: "contents" },
    template: `
        <div [class]="classes()">
            @if (title()) {
                <h2 class="text-base">{{ title() }}</h2>
            }
            <ng-content />
        </div>
    `,
})
export class PanelBody {
    readonly title = input<string | undefined>(undefined);
    readonly bodyClass = input<string | undefined>(undefined);
    protected readonly classes = () =>
        cn("flex min-h-full flex-col gap-3 p-4", this.bodyClass());
}

/**
 * Content with state you can see: a counter and a text input. Move the tab to another tabset,
 * maximize it or pop it out, and both keep their value: the content is never re-created.
 */
@Component({
    selector: "kit-card",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body [title]="name()">
            <p class="text-palette-accent/85">
                Drag the tab, resize with the splitters. The counter and the notes survive every
                move.
            </p>
            <div class="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    data-testid="counter"
                    class="palette-blue inline-flex h-8 items-center gap-1.5 rounded-md bg-palette-base px-3 text-sm font-medium text-palette-contrast outline-none hover:bg-palette-base-hover focus-visible:ring-2 focus-visible:ring-palette-ring focus-visible:ring-offset-2"
                    (click)="count.set(count() + 1)"
                >Count: {{ count() }}</button>
                <input
                    data-testid="notes"
                    [attr.aria-label]="name() + ' notes'"
                    placeholder="Notes"
                    class="h-8 min-w-0 rounded-md border border-palette-line bg-palette-soft px-3 text-sm placeholder:text-palette-accent/85 focus-visible:outline-2 focus-visible:outline-palette-ring"
                />
            </div>
            <ng-content />
        </kit-panel-body>
    `,
})
export class Card {
    readonly name = input.required<string>();
    protected readonly count = signal(0);
}
