import { Component, input, output } from "@angular/core";
import {
    DOCKABLE,
    type DragSubject,
    type Model,
    type TabOf,
} from "@fragiola/dockable-angular";
import { LucideDynamicIcon, type LucideIcon } from "@lucide/angular";
import type { Types } from "./index";
import * as styles from "./styles";

/** The dragged tab of the layout, or undefined for a tabset or a new tab. */
function draggedTab(drag: DragSubject<Types>): TabOf<Types> | undefined {
    return drag.kind === "tab" ? drag.tab : undefined;
}

/** A zone outside the layout that takes a dragged tab: `(dropped)` says which one. */
@Component({
    selector: "example-drop-zone",
    imports: [DOCKABLE, LucideDynamicIcon],
    host: { class: "contents" },
    template: `
        <!-- the zones take tabs only -->
        <div
            [dockableDropZone]="model()"
            [accepts]="takes"
            (dropped)="onDropped($event.drag)"
            [attr.data-testid]="'zone-' + zoneId()"
            [class]="styles.zone(tone())"
        >
            <svg [lucideIcon]="icon()" aria-hidden="true" [class]="styles.zoneIcon"></svg
            >{{ label() }}</div
        >
    `,
})
export class Zone {
    readonly zoneId = input.required<string>();
    readonly model = input.required<Model<Types>>();
    readonly icon = input.required<LucideIcon>();
    readonly label = input.required<string>();
    readonly tone = input.required<styles.Tone>();
    readonly accepts = input<(tab: TabOf<Types>) => boolean>(() => true);
    readonly dropped = output<TabOf<Types>>();
    protected readonly styles = styles;

    protected readonly takes = (drag: DragSubject<Types>) => {
        const tab = draggedTab(drag);
        return tab !== undefined && this.accepts()(tab);
    };

    protected onDropped(drag: DragSubject<Types>) {
        const tab = draggedTab(drag);
        if (tab) this.dropped.emit(tab);
    }
}
