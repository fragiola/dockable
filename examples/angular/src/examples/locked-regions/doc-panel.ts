import { Component, input, output } from "@angular/core";
import {
    injectDockable,
    injectModelState,
    type TabOf,
} from "@fragiola/dockable-angular";
import { PanelBody } from "../_kit/card";
import { REFERENCE, type Types } from "./regions";
import * as styles from "./styles";

/** The content of a document tab, with a button that tries to break the rule from code. */
@Component({
    selector: "example-locked-regions-doc",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body [title]="tab().label">
            <p [class]="styles.panelText">
                {{ "Region: " + tab().data.region + ". " }}{{
                    tab().data.region === REFERENCE
                        ? "This tab may be dropped into Reference."
                        : "Reference refuses this tab: try dragging it there."
                }}
            </p>
            @if (tab().data.region !== REFERENCE && !inReference()) {
                <div>
                    <button type="button" [class]="styles.button" (click)="moveToReference()">
                        Move to Reference from code
                    </button>
                </div>
            }
        </kit-panel-body>
    `,
})
export class DocPanel {
    readonly tab =
        input.required<Extract<TabOf<Types>, { component: "doc" }>>();
    readonly notice = output<string | undefined>();
    protected readonly styles = styles;
    protected readonly REFERENCE = REFERENCE;
    private readonly dockable = injectDockable<Types>();
    // where the tab is follows the model (the panel's content does not render again by itself)
    protected readonly inReference = injectModelState<Types, boolean>(
        (_state, model) =>
            model.get("node-parent-by", { nodeId: this.tab().id })?.id ===
            REFERENCE,
    );

    // a command from code goes through the same middleware: the result says why it was refused
    protected moveToReference() {
        const result = this.dockable.model().run("tab.move", {
            tabId: this.tab().id,
            to: REFERENCE,
            location: "center",
            index: -1,
        });
        this.notice.emit(result.ok ? undefined : result.error.message);
    }
}
