import { Component, computed, input, signal } from "@angular/core";
import {
    injectDockable,
    type TabNode,
    type TabOf,
} from "@fragiola/dockable-angular";
import {
    LucideCircleCheck,
    LucideCircleX,
    LucideDynamicIcon,
    LucideTriangleAlert,
} from "@lucide/angular";
import { Badge } from "#/components/atoms/badge";
import { PanelBody } from "../_kit/card";
import type { DocumentData, MonitorData, Status, Types } from "./index";
import * as styles from "./styles";

const STATUS = {
    healthy: { icon: LucideCircleCheck, text: "Healthy" },
    degraded: { icon: LucideTriangleAlert, text: "Degraded" },
    down: { icon: LucideCircleX, text: "Down" },
} as const;

/** What a tab shows about its content, read from its typed data. */
function tabState(tab: TabOf<Types>) {
    switch (tab.component) {
        case "monitor":
            return {
                status: tab.data.status,
                incidents: tab.data.incidents,
                dirty: false,
            };
        case "document":
            return { status: undefined, incidents: 0, dirty: tab.data.dirty };
    }
}

/** The tab's content: it only reads the data and turns it into `data-*` and a palette. */
@Component({
    selector: "[exampleStatusTab]",
    imports: [LucideDynamicIcon, Badge],
    host: {
        "[attr.data-status]": "shown().status ?? null",
        "[attr.data-modified]": "shown().dirty ? '' : null",
        "[class]": "styles.tab(shown().status)",
    },
    template: `
        @if (status(); as status) {
            <svg [lucideIcon]="status.icon" aria-hidden="true" [class]="styles.tabIcon"></svg>
        }
        <span [class]="styles.tabName">{{ tab().label }}</span>
        @if (shown().incidents) {
            <span
                kitBadge
                variant="solid"
                [attr.aria-label]="shown().incidents + ' incidents'"
                [class]="styles.tabIncidents"
            >{{ shown().incidents }}</span>
        }
        @if (shown().dirty) {
            <!-- the "modified" dot; its text is for screen readers only -->
            <span [class]="styles.tabModified"><span [class]="styles.srOnly">Modified</span></span>
        }
    `,
})
export class StatusTab {
    /** The tab of the `[dockableTab]` element this is on. */
    readonly tab = input.required<TabOf<Types>>({ alias: "dockableTab" });
    protected readonly styles = styles;
    protected readonly shown = computed(() => tabState(this.tab()));
    protected readonly status = computed(() => {
        const current = this.shown().status;
        return current ? STATUS[current] : undefined;
    });
}

/** Content that reports its status to its tab. */
@Component({
    selector: "example-monitor",
    imports: [PanelBody],
    host: { class: "contents" },
    template: `
        <kit-panel-body [title]="tab().label + ' service'">
            <p [class]="styles.monitorText">
                Set the service's health. The panel writes it into the tab's data with a command;
                the tab reads it back.
            </p>
            <fieldset [class]="styles.statusList">
                <legend [class]="styles.srOnly">Status</legend>
                @for (status of STATUSES; track status) {
                    <button
                        type="button"
                        [attr.aria-pressed]="tab().data.status === status"
                        [class]="styles.statusButton(status, tab().data.status === status)"
                        (click)="report(status)"
                    >{{ STATUS[status].text }}</button>
                }
            </fieldset>
            <p [class]="styles.incidents">{{ "Incidents so far: " + tab().data.incidents }}</p>
        </kit-panel-body>
    `,
})
export class Monitor {
    readonly tab = input.required<TabNode<"monitor", MonitorData>>();
    protected readonly styles = styles;
    protected readonly STATUS = STATUS;
    protected readonly STATUSES = Object.keys(STATUS) as Status[];
    private readonly dockable = injectDockable<Types>();

    protected report(status: Status) {
        const { id, data } = this.tab();
        if (status === data.status) {
            return;
        }
        // `tab.set-data` patches the data: the keys it passes change, the others stay
        this.dockable.model().run("tab.set-data", {
            tabId: id,
            data: {
                status,
                incidents: data.incidents + (status === "healthy" ? 0 : 1),
            },
        });
    }
}

/** An editor that marks its tab as modified while its text differs from the saved one. */
@Component({
    selector: "example-editor",
    host: { class: "contents" },
    template: `
        <div [class]="styles.editor">
            <textarea
                [attr.aria-label]="tab().label + ' text'"
                [value]="text()"
                [class]="styles.editorText"
                (input)="onInput($event)"
            ></textarea>
            <div>
                <button type="button" [class]="styles.saveButton" (click)="save()">Save</button>
            </div>
        </div>
    `,
})
export class Editor {
    readonly tab = input.required<TabNode<"document", DocumentData>>();
    protected readonly styles = styles;
    private readonly dockable = injectDockable<Types>();
    private readonly saved = signal("");
    protected readonly text = signal("");

    ngOnInit() {
        this.saved.set(`# ${this.tab().label}\n`);
        this.text.set(this.saved());
    }

    private setDirty(dirty: boolean) {
        // only run the command when the flag changes, not on every keystroke
        const tab = this.tab();
        if (tab.data.dirty !== dirty) {
            this.dockable
                .model()
                .run("tab.set-data", { tabId: tab.id, data: { dirty } });
        }
    }

    protected onInput(event: Event) {
        const value = (event.target as HTMLTextAreaElement).value;
        this.text.set(value);
        this.setDirty(value !== this.saved());
    }

    protected save() {
        this.saved.set(this.text());
        this.setDirty(false);
    }
}
