import {
    afterNextRender,
    Component,
    type ElementRef,
    input,
    type OnInit,
    output,
    signal,
    viewChild,
} from "@angular/core";
import { cn } from "#/lib/cn";

// An inline text field that edits a tab's name: Enter confirms, Escape cancels, leaving the field
// confirms. An empty name is refused (the field stays open and is marked invalid; leaving it
// cancels). The caller runs `tab.rename` with the new label on `(commit)`.

@Component({
    selector: "kit-rename-field",
    host: { class: "contents" },
    template: `
        <input
            #input
            aria-label="Tab name"
            [attr.aria-invalid]="invalid() || null"
            [value]="value()"
            [attr.size]="size()"
            [class]="classes"
            (input)="onInput($event)"
            (keydown)="onKeydown($event)"
            (blur)="onBlur($event)"
        />
    `,
})
export class RenameField implements OnInit {
    readonly name = input.required<string>();
    readonly commit = output<string>();
    readonly cancel = output<void>();
    protected readonly value = signal("");
    protected readonly invalid = signal(false);
    protected readonly size = () => Math.max(4, this.value().length);
    protected readonly classes = cn(
        "h-6 min-w-0 rounded-sm border border-palette-line bg-palette-base px-1 text-palette-contrast outline-none",
        "focus-visible:ring-2 focus-visible:ring-palette-ring aria-invalid:border-palette-ring aria-invalid:ring-2",
    );
    private readonly input =
        viewChild.required<ElementRef<HTMLInputElement>>("input");
    // Enter closes the field, and the removal may still blur it: finish once
    private done = false;

    constructor() {
        // focus and select once rendered, so typing replaces the name
        afterNextRender(() => {
            const element = this.input().nativeElement;
            if (element !== element.ownerDocument.activeElement) {
                element.focus();
                element.select();
            }
        });
    }

    ngOnInit() {
        this.value.set(this.name());
    }

    private finish(commit: boolean, element: HTMLInputElement) {
        if (this.done) return;
        const trimmed = this.value().trim();
        if (commit && trimmed === "") {
            this.invalid.set(true);
            return;
        }
        this.done = true;
        // hand focus back to the tab the field is in (unless it already went elsewhere)
        if (element.ownerDocument.activeElement === element) {
            element.closest<HTMLElement>('[role="tab"]')?.focus();
        }
        if (commit && trimmed !== this.name()) {
            this.commit.emit(trimmed);
        } else {
            this.cancel.emit();
        }
    }

    protected onKeydown(event: KeyboardEvent) {
        // the tab leaves the keys typed in the field to it
        const element = event.currentTarget as HTMLInputElement;
        if (event.key === "Enter") {
            this.finish(true, element);
        } else if (event.key === "Escape") {
            this.finish(false, element);
        }
    }

    protected onInput(event: Event) {
        this.value.set((event.currentTarget as HTMLInputElement).value);
        this.invalid.set(false);
    }

    protected onBlur(event: FocusEvent) {
        this.finish(
            this.value().trim() !== "",
            event.currentTarget as HTMLInputElement,
        );
    }
}
