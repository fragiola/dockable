import { Component, input } from "@angular/core";
import {
    type BorderNode,
    injectModelState,
    type Model,
} from "@fragiola/dockable-angular";
import type { Types } from "./index";
import * as styles from "./styles";

// the borders whose mode the toolbar switches
const SWITCHABLE = ["start", "bottom"] as const;

/**
 * The toolbar outside the layout: it follows the borders (a model-state selection, so a commit
 * renders it again, not the layout). A switch per border flips its mode with `border.configure`.
 */
@Component({
    selector: "example-overlay-borders-toolbar",
    host: { class: "contents" },
    template: `
        <div [class]="styles.toolbar">
            @for (item of switches(); track item.border.id) {
                <button
                    type="button"
                    [attr.data-testid]="'type-' + item.name"
                    [class]="styles.modeButton"
                    [attr.aria-pressed]="item.overlay"
                    (click)="toggle(item.border, item.overlay)"
                >{{ item.label }}</button>
            }
            <p [class]="styles.hint">
                Drag a tab towards the right edge (above or below its middle) to reveal the hidden
                border.
            </p>
        </div>
    `,
})
export class Toolbar {
    readonly model = input.required<Model<Types>>();
    protected readonly styles = styles;
    protected readonly switches = injectModelState<Types, Switch[]>(
        (_state, model) =>
            SWITCHABLE.flatMap((location) => {
                const border = model
                    .get("borders")
                    .find((candidate) => candidate.location === location);
                if (!border) return [];
                // the border's mode, resolved against the layout defaults
                const overlay = model.is("border-overlay", {
                    borderId: border.id,
                });
                const name = border.location;
                return [
                    {
                        border,
                        name,
                        overlay,
                        label: `${name[0]?.toUpperCase()}${name.slice(1)}: ${overlay ? "overlay" : "split"}`,
                    },
                ];
            }),
        { model: this.model },
    );

    protected toggle(border: BorderNode<Types>, overlay: boolean) {
        this.model().run("border.configure", {
            borderId: border.id,
            mode: overlay ? "docked" : "overlay",
        });
    }
}

interface Switch {
    border: BorderNode<Types>;
    name: string;
    overlay: boolean;
    label: string;
}
