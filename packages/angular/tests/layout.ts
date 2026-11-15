import { NgTemplateOutlet } from "@angular/common";
import {
    Component,
    type ComponentRef,
    input,
    type OnInit,
    signal,
    type Type,
} from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { KeyMap, LayoutJson, Model } from "@fragiola/dockable";
import { DOCKABLE } from "../src/public-api";

/** The registry of the fixture layouts: every tab has a name. */
export type Types = { tabs: { test: { name: string } } };

export const twoTabsets: LayoutJson<Types> = {
    version: 1,
    root: {
        type: "row",
        id: "row",
        children: [
            {
                type: "tabset",
                id: "ts0",
                children: [
                    {
                        id: "t0",
                        component: "test",
                        label: "One",
                        data: { name: "One" },
                    },
                    {
                        id: "t1",
                        component: "test",
                        label: "Two",
                        data: { name: "Two" },
                    },
                ],
            },
            {
                type: "tabset",
                id: "ts1",
                children: [
                    {
                        id: "t2",
                        component: "test",
                        label: "Three",
                        data: { name: "Three" },
                    },
                ],
            },
        ],
    },
};

/** How many times each tab's content was created. */
export const mounts = new Map<string, number>();

/** Tab content with observable state: a counter, an input, and a creation counter. */
@Component({
    selector: "test-counter",
    template: `<div [attr.data-testid]="'content-' + id()">
        <button type="button" [attr.data-testid]="'inc-' + id()" (click)="count.set(count() + 1)">
            count {{ count() }}
        </button>
        <input [attr.data-testid]="'input-' + id()" [attr.aria-label]="'input ' + id()" />
        @if (count() >= 0) {
            <span [attr.data-testid]="'live-' + id()"></span>
        }
    </div>`,
})
export class Counter implements OnInit {
    readonly id = input.required<string>();
    readonly count = signal(0);

    ngOnInit() {
        mounts.set(this.id(), (mounts.get(this.id()) ?? 0) + 1);
    }
}

/** The fixture layout: every primitive, composed with template directives. */
@Component({
    selector: "test-layout",
    imports: [DOCKABLE, NgTemplateOutlet, Counter],
    template: `
        <div
            [dockableRoot]="model()"
            [attr.data-testid]="testId()"
            [supportsPopout]="supportsPopout()"
            [keyMap]="keyMap()"
        >
            <div dockableRow>
                <ng-template [dockableRowChild]="model()" let-node>
                    <ng-container
                        *ngTemplateOutlet="nodeTemplate; context: { $implicit: node }"
                    />
                </ng-template>
            </div>
            <ng-template #nodeTemplate let-node>
                @if (node.type === "tabset") {
                    <div [dockableTabSet]="node">
                        <div dockableTabList>
                            <ng-template dockableTabListItem let-tab>
                                <div [dockableTab]="tab">{{ tab.label }}</div>
                            </ng-template>
                        </div>
                        <div dockableTabSetContent></div>
                    </div>
                } @else {
                    <div [dockableRow]="node">
                        <ng-template dockableRowChild let-child>
                            <ng-container
                                *ngTemplateOutlet="nodeTemplate; context: { $implicit: child }"
                            />
                        </ng-template>
                    </div>
                }
            </ng-template>
            <ng-template [dockablePanels]="model()" let-tab>
                <div [dockablePanel]="tab" [remountInWindow]="tab.id === remountInWindow()">
                    <test-counter [id]="tab.id" />
                </div>
            </ng-template>
            <ng-template [dockablePopout]="model()" let-layout>
                <div [dockablePopoutLayout]="layout" data-testid="popout">
                    <div dockableRow>
                        <ng-template dockableRowChild let-node>
                            <ng-container
                                *ngTemplateOutlet="nodeTemplate; context: { $implicit: node }"
                            />
                        </ng-template>
                    </div>
                </div>
            </ng-template>
            <div dockableDropIndicator [attr.data-testid]="testId() + '-indicator'"></div>
        </div>
    `,
})
export class Layout {
    readonly model = input.required<Model<Types>>();
    readonly testId = input("root");
    readonly supportsPopout = input<boolean | undefined>(undefined);
    readonly keyMap = input<KeyMap | undefined>(undefined);
    /** the tab whose panel remounts its content in another window */
    readonly remountInWindow = input<string | undefined>(undefined);
}

/** Renders `component` in the document (with `inputs`) and lets it settle. */
export async function render<C>(
    component: Type<C>,
    inputs: Record<string, unknown> = {},
): Promise<ComponentFixture<C>> {
    const fixture = TestBed.createComponent(component);
    document.body.appendChild(fixture.nativeElement as HTMLElement);
    for (const [name, value] of Object.entries(inputs)) {
        fixture.componentRef.setInput(name, value);
    }
    await settle(fixture);
    return fixture;
}

/** Renders the fixture layout for `model`. */
export function renderLayout(
    model: Model<Types>,
    inputs: Record<string, unknown> = {},
) {
    return render(Layout, { model, ...inputs });
}

/** Lets the renders, the measure cycles and the timers they schedule run. */
export async function settle(fixture?: { whenStable(): Promise<unknown> }) {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await fixture?.whenStable();
    }
}

/** Sets an input of a rendered component and lets it settle. */
export async function setInput<C>(
    fixture: ComponentFixture<C>,
    name: string,
    value: unknown,
) {
    (fixture.componentRef as ComponentRef<C>).setInput(name, value);
    await settle(fixture);
}

/** The commands a model ran, recorded by a middleware (engine-issued and direct alike). */
export function recordCommands(
    model: Model<Types>,
): { command: string; payload: unknown; transient: boolean }[] {
    const commands: {
        command: string;
        payload: unknown;
        transient: boolean;
    }[] = [];
    model.use((ctx, next) => {
        if (!ctx.dryRun && !ctx.inBatch) {
            commands.push({
                command: ctx.command,
                payload: ctx.payload,
                transient: ctx.transient,
            });
        }
        return next();
    });
    return commands;
}
