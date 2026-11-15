import { Component, input } from "@angular/core";
import { injectDockable, type TabsetNode } from "@fragiola/dockable-angular";
import { LucidePlus } from "@lucide/angular";
import { DROPDOWN_MENU } from "#/components/ui/dropdown-menu";
import { type Kind, TEMPLATES, type Types } from "./factory";
import * as styles from "./styles";

const KINDS: { kind: Kind; title: string }[] = [
    { kind: "chart", title: "Chart" },
    { kind: "table", title: "Table" },
    { kind: "markdown", title: "Markdown" },
    { kind: "form", title: "Form" },
];

/** The "Add" menu of a tabset: a new tab of any kind, with its own data. */
@Component({
    selector: "example-factory-add-menu",
    imports: [DROPDOWN_MENU, LucidePlus],
    host: { class: "contents" },
    template: `
        <button
            type="button"
            [kitDropdownMenuTrigger]="menu"
            aria-label="Add a tab"
            [class]="styles.iconButton"
        >
            <svg lucidePlus aria-hidden="true" [class]="styles.iconButtonIcon"></svg>
        </button>
        <ng-template #menu>
            <div kitDropdownMenuContent align="end">
                @for (item of KINDS; track item.kind) {
                    <div kitDropdownMenuItem (select)="add(item.kind)">{{ item.title }}</div>
                }
            </div>
        </ng-template>
    `,
})
export class AddMenu {
    readonly tabset = input.required<TabsetNode<Types>>();
    protected readonly styles = styles;
    protected readonly KINDS = KINDS;
    private readonly dockable = injectDockable<Types>();

    protected add(kind: Kind) {
        this.dockable.model().run("tab.add", {
            ...TEMPLATES[kind],
            to: this.tabset().id,
            select: true, // select it: its content renders now
        });
    }
}
