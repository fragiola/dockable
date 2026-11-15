import { Component } from "@angular/core";
import {
    createModel,
    DOCKABLE,
    type LayoutJson,
} from "@fragiola/dockable-angular";
import { Pane } from "./pane";
import * as styles from "./styles";

// Two layouts with their own models, in one drag group: drag a tab from one into the other. Each
// model's middleware sees its side (a `tab.add` in the target, a `tab.close` in the source, both
// marked `meta.transfer`), and either can refuse. The tab's content moves with it.

// What both layouts hold: one tab component, named by its label. A transferred tab keeps its label,
// component and data, so the two models share the registry.
export type Types = { tabs: { card: undefined } };

const card = (name: string) => ({ component: "card" as const, label: name });

const workspace: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [card("Report"), card("Chart"), card("Data")],
            },
        ],
    },
};

const scratch: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        children: [{ type: "tabset", children: [card("Ideas")] }],
    },
};

@Component({
    selector: "example-two-layouts",
    imports: [DOCKABLE, Pane],
    host: { class: "contents" },
    template: `
        <!-- one drag group around both roots: a tab dragged out of one can drop into the other -->
        <div dockableDragGroup [class]="styles.panes">
            <example-two-layouts-pane title="Workspace" [model]="workspaceModel" />
            <example-two-layouts-pane title="Scratch" [model]="scratchModel" />
        </div>
    `,
})
export default class TwoLayouts {
    protected readonly styles = styles;
    protected readonly workspaceModel = createModel<Types>(workspace);
    protected readonly scratchModel = createModel<Types>(scratch);
}
