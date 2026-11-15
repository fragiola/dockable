// Angular port of the Fragiola UI input atom and its simple template
// (examples/react/src/components/atoms/fields): the same classes and palette roles (the `field`
// family) on a native `<input>`. `<kit-input-simple>` is a whole field: label, row, input,
// description and error, linked by id.
//
//     <kit-input-simple label="Email" type="email" [value]="initial" />
//
// `value` is the input's initial value, set as its `value` attribute: a re-render keeps what the
// user typed (the `value` property would reset it), as React's `defaultValue`.

import {
    booleanAttribute,
    Component,
    computed,
    Directive,
    inject,
    input,
} from "@angular/core";
import { field } from "#/components/families/field";
import { FIELD, FieldRoot } from "#/components/ui/field";
import { cn } from "#/lib/cn";

/** A native input with the field family's control classes, named by its field's label. */
@Directive({
    selector: "input[kitInput]",
    host: {
        "data-slot": "input",
        "[attr.id]": "root?.controlId ?? null",
        "[class]": "classes()",
    },
})
export class Input {
    readonly class = input<string>();
    protected readonly root = inject(FieldRoot, { optional: true });
    protected readonly classes = computed(() =>
        cn(field.control(), this.class()),
    );
}

@Component({
    selector: "kit-input-simple",
    imports: [FIELD, Input],
    host: { class: "contents" },
    template: `
        <div kitFieldRoot>
            @if (label()) {
                <label kitFieldLabel
                    >{{ label() }}@if (required()) {<span aria-hidden="true">*</span>}</label
                >
            }
            <div kitFieldRow>
                <div kitFieldBody [class]="class()">
                    @if (insetStart()) {
                        <span [class]="inset">{{ insetStart() }}</span>
                    }
                    <input
                        kitInput
                        [attr.type]="type()"
                        [attr.name]="name()"
                        [attr.placeholder]="placeholder()"
                        [attr.value]="value()"
                        [required]="required()"
                    />
                    @if (insetEnd()) {
                        <span [class]="inset">{{ insetEnd() }}</span>
                    }
                </div>
            </div>
            @if (description()) {
                <p kitFieldDescription>{{ description() }}</p>
            }
            @if (error()) {
                <span kitFieldError>{{ error() }}</span>
            }
        </div>
    `,
})
export class InputSimple {
    readonly label = input<string>();
    readonly description = input<string>();
    readonly error = input<string>();
    readonly required = input(false, { transform: booleanAttribute });
    readonly type = input("text");
    readonly name = input<string>();
    readonly placeholder = input<string>();
    /** The initial value (the `value` attribute). */
    readonly value = input<string>();
    readonly insetStart = input<string>();
    readonly insetEnd = input<string>();
    /** Classes of the field's body. */
    readonly class = input<string>();
    protected readonly inset = field.inset();
}
