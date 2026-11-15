// Angular port of the Fragiola UI context menu (examples/react/src/components/ui/context-menu.tsx):
// the same parts, classes and palette roles, over Angular CDK's menu. The trigger is a directive on
// your own element (a `[dockableTab]` for example, where the React kit takes `render`), given the
// menu's template; a right-click opens it at the pointer, Shift+F10 or the context menu key at the
// element. The parts come from the menu family:
//
//     <div [dockableTab]="tab" [kitContextMenuTrigger]="menu" (openChange)="…">…</div>
//     <ng-template #menu>
//         <div kitContextMenuContent>
//             <div kitContextMenuItem [disabled]="!canClose" (select)="close()">Close</div>
//         </div>
//     </ng-template>
//
// CDK's own `cdkContextMenuTriggerFor` opens in the overlay container of the main document; this
// one opens in the body of the trigger's document, so it works in a popout window.

import { Directive, input, output, type TemplateRef } from "@angular/core";
import { MENU_PARTS } from "#/components/families/menu/parts";
import { injectPopup } from "#/components/floating";

/** Opens its menu where the element is right-clicked. */
@Directive({
    selector: "[kitContextMenuTrigger]",
    exportAs: "kitContextMenuTrigger",
    host: {
        "data-slot": "context-menu-trigger",
        "[attr.data-popup-open]": "popup.open() ? '' : null",
        "(contextmenu)": "openAt($event)",
        "(keydown.shift.f10)": "openAtElement($event)",
        "(keydown.contextmenu)": "openAtElement($event)",
    },
})
export class ContextMenuTrigger {
    readonly kitContextMenuTrigger = input.required<TemplateRef<unknown>>();
    /** Says when the menu opens (`true`) or closes. */
    readonly openChange = output<boolean>();
    protected readonly popup = injectPopup((open) =>
        this.openChange.emit(open),
    );

    protected openAt(event: MouseEvent) {
        event.preventDefault();
        this.popup.show(this.kitContextMenuTrigger(), {
            anchor: { x: event.clientX, y: event.clientY },
            side: "bottom",
            align: "start",
            sideOffset: 0,
        });
    }

    protected openAtElement(event: Event) {
        event.preventDefault();
        this.popup.show(this.kitContextMenuTrigger(), {
            side: "bottom",
            align: "start",
        });
    }
}

/** The trigger and every part of a context menu, for a component's `imports`. */
export const CONTEXT_MENU = [ContextMenuTrigger, ...MENU_PARTS] as const;
