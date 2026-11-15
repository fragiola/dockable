// Angular port of the Fragiola UI dropdown menu (examples/react/src/components/ui/dropdown-menu.tsx):
// the same parts, classes and palette roles, over Angular CDK's menu. The trigger is a directive on
// your own element (where the React kit takes `render`), given the menu's template; the template's
// root element is the content, and the parts come from the menu family:
//
//     <button [kitDropdownMenuTrigger]="menu" aria-label="Add a tab">…</button>
//     <ng-template #menu>
//         <div kitDropdownMenuContent align="end">
//             <div kitDropdownMenuItem (select)="add()">Table</div>
//         </div>
//     </ng-template>
//
// The menu opens in the body of the trigger's document (a popout window's, once the trigger moved
// there), below the trigger; Escape or a press outside closes it.

import { Directive, input, output, type TemplateRef } from "@angular/core";
import { MENU_PARTS } from "#/components/families/menu/parts";
import { injectPopup } from "#/components/floating";

/** Opens its menu on click (and Enter, Space, ArrowDown). */
@Directive({
    selector: "[kitDropdownMenuTrigger]",
    exportAs: "kitDropdownMenuTrigger",
    host: {
        "data-slot": "dropdown-menu-trigger",
        "aria-haspopup": "menu",
        "[attr.aria-expanded]": "popup.open()",
        "[attr.data-popup-open]": "popup.open() ? '' : null",
        "(click)": "toggle()",
        "(keydown.arrowdown)": "openFromKeyboard($event)",
    },
})
export class DropdownMenuTrigger {
    readonly kitDropdownMenuTrigger = input.required<TemplateRef<unknown>>();
    /** Says when the menu opens (`true`) or closes. */
    readonly openChange = output<boolean>();
    protected readonly popup = injectPopup((open) =>
        this.openChange.emit(open),
    );

    toggle() {
        if (this.popup.open()) {
            this.popup.hide();
        } else {
            this.popup.show(this.kitDropdownMenuTrigger(), { side: "bottom" });
        }
    }

    protected openFromKeyboard(event: Event) {
        event.preventDefault();
        if (!this.popup.open()) this.toggle();
    }
}

/** The trigger and every part of a dropdown menu, for a component's `imports`. */
export const DROPDOWN_MENU = [DropdownMenuTrigger, ...MENU_PARTS] as const;
