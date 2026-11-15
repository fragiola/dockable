// Angular port of the Fragiola UI alert dialog (examples/react/src/components/ui/alert-dialog.tsx):
// the same parts, classes and palette roles (the `layer` family), with Angular CDK's focus trap
// (`CdkTrapFocus`: focus moves in, stays in, and returns to where it was on close).
//
// What differs from the React one, and why:
//   - CDK's Dialog opens in the overlay container of the main document; this one opens in the body
//     of the document its template is declared in (`#/components/floating`), a popout window's too.
//   - Root and Portal are one directive on an `<ng-template>`: `[kitAlertDialog]="open"` renders
//     the template on top of the page while `open` is true; Escape asks to close it
//     (`(openChange)` says `false`). An alert dialog does not close on a press outside.
//
//         <ng-template [kitAlertDialog]="open()" (openChange)="!$event && cancel()">
//             <div kitAlertDialogBackdrop></div>
//             <div kitAlertDialogContent>
//                 <div kitAlertDialogHeader>
//                     <h2 kitAlertDialogTitle>Save changes?</h2>
//                     <p kitAlertDialogDescription>…</p>
//                 </div>
//                 <div kitAlertDialogFooter>…</div>
//             </div>
//         </ng-template>

import { CdkTrapFocus } from "@angular/cdk/a11y";
import {
    Component,
    computed,
    Directive,
    effect,
    inject,
    input,
    output,
    signal,
    TemplateRef,
    untracked,
} from "@angular/core";
import { layer } from "#/components/families/layer";
import { injectPopup } from "#/components/floating";
import { cn } from "#/lib/cn";

let nextId = 0;

/** Renders its template on top of the page while the input is true. */
@Directive({ selector: "ng-template[kitAlertDialog]" })
export class AlertDialogRoot {
    readonly kitAlertDialog = input(false);
    /** Escape asks to close the dialog (`false`); the input decides. */
    readonly openChange = output<boolean>();
    private readonly template: TemplateRef<unknown> = inject(TemplateRef);
    private readonly popup = injectPopup();

    constructor() {
        effect(() => {
            const open = this.kitAlertDialog();
            untracked(() => {
                if (open && !this.popup.open()) {
                    this.popup.show(this.template, {
                        cover: true,
                        onDismiss: (reason) => {
                            if (reason === "escape")
                                this.openChange.emit(false);
                        },
                    });
                } else if (!open && this.popup.open()) {
                    this.popup.hide();
                }
            });
        });
    }
}

/** The scrim behind the dialog. */
@Directive({
    selector: "[kitAlertDialogBackdrop]",
    host: { "data-slot": "layer-backdrop", "[class]": "classes()" },
})
export class AlertDialogBackdrop {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(layer.backdrop(), this.class()),
    );
}

/** The dialog's panel, centred over the backdrop; named by its title, described by its description. */
@Component({
    selector: "[kitAlertDialogContent]",
    hostDirectives: [CdkTrapFocus],
    host: {
        // `z-50` lifts the wrapper above the backdrop: `position: fixed` makes a stacking context
        class: "fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4",
    },
    template: `
        <div
            role="alertdialog"
            aria-modal="true"
            data-slot="alert-dialog-content"
            data-open=""
            tabindex="-1"
            [attr.aria-labelledby]="titleId()"
            [attr.aria-describedby]="descriptionId()"
            [class]="classes()"
        >
            <ng-content />
        </div>
    `,
})
export class AlertDialogContent {
    readonly class = input<string>();
    readonly titleId = signal<string | undefined>(undefined);
    readonly descriptionId = signal<string | undefined>(undefined);
    protected readonly classes = computed(() =>
        cn(
            layer.panel(),
            "duration-200 data-starting-style:scale-95 data-ending-style:scale-95",
            "w-full max-w-lg",
            this.class(),
        ),
    );

    constructor() {
        // focus moves into the dialog when it opens, and back where it was when it closes
        const trap = inject(CdkTrapFocus);
        trap.autoCapture = true;
    }
}

@Directive({
    selector: "[kitAlertDialogHeader]",
    host: { "data-slot": "layer-header", "[class]": "classes()" },
})
export class AlertDialogHeader {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(layer.header(), this.class()),
    );
}

@Directive({
    selector: "[kitAlertDialogBody]",
    host: { "data-slot": "layer-body", "[class]": "classes()" },
})
export class AlertDialogBody {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(layer.body(), this.class()));
}

@Directive({
    selector: "[kitAlertDialogFooter]",
    host: { "data-slot": "layer-footer", "[class]": "classes()" },
})
export class AlertDialogFooter {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(layer.footer(), this.class()),
    );
}

/** The dialog's name (an `<h2>`, as Base UI renders it). */
@Directive({
    selector: "[kitAlertDialogTitle]",
    host: {
        "data-slot": "layer-title",
        "[id]": "id",
        "[class]": "classes()",
    },
})
export class AlertDialogTitle {
    readonly class = input<string>();
    protected readonly id = `kit-alert-dialog-title-${++nextId}`;
    protected readonly classes = computed(() =>
        cn(
            "font-semibold text-palette-contrast text-xl",
            layer.title(),
            this.class(),
        ),
    );

    constructor() {
        inject(AlertDialogContent).titleId.set(this.id);
    }
}

/** The dialog's description. */
@Directive({
    selector: "[kitAlertDialogDescription]",
    host: {
        "data-slot": "layer-description",
        "[id]": "id",
        "[class]": "classes()",
    },
})
export class AlertDialogDescription {
    readonly class = input<string>();
    protected readonly id = `kit-alert-dialog-description-${++nextId}`;
    protected readonly classes = computed(() =>
        cn(
            "text-palette-contrast text-sm transition-all",
            layer.description(),
            this.class(),
        ),
    );

    constructor() {
        inject(AlertDialogContent).descriptionId.set(this.id);
    }
}

/** Every part of an alert dialog, for a component's `imports`. */
export const ALERT_DIALOG = [
    AlertDialogRoot,
    AlertDialogBackdrop,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogBody,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
] as const;
