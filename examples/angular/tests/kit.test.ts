// @vitest-environment jsdom

import { Component, signal, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Badge } from "#/components/atoms/badge";
import { ClickableButton } from "#/components/atoms/clickable";
import { InputSimple } from "#/components/atoms/fields";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import { track } from "#/components/families/track";
import { ALERT_DIALOG } from "#/components/ui/alert-dialog";
import { Chart } from "#/components/ui/chart";
import { CONTEXT_MENU } from "#/components/ui/context-menu";
import { DROPDOWN_MENU } from "#/components/ui/dropdown-menu";
import { PROGRESS } from "#/components/ui/progress";
import { SELECT_PARTS } from "#/components/ui/select";
import { SWITCH } from "#/components/ui/switch";
import { TABLE } from "#/components/ui/table";
import { TOOLTIP } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";

// The Angular kit renders what the React kit does: the same roles, accessible names and family
// classes (the shared e2e specs reach the examples through roles and names). Popups open in the
// document their trigger is in: a popout window's document adopts the nodes the main one created,
// so the "popout" here is a second document the rendered component is moved into before its
// popup opens.

beforeAll(() => {
    // what jsdom lacks and the parts measure with
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.PointerEvent ??= MouseEvent as typeof PointerEvent;
    Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = "";
});

/** Renders `component`, moved into `doc` (the page's, or a popout's), and returns its root. */
async function render<T>(component: Type<T>, doc = document) {
    const fixture = TestBed.createComponent(component);
    const root = fixture.nativeElement as HTMLElement;
    if (doc !== document) doc.body.append(root);
    await fixture.whenStable();
    return {
        doc,
        root,
        fixture,
        stable: async () => {
            await Promise.resolve();
            await fixture.whenStable();
        },
    };
}

const popout = () => document.implementation.createHTMLDocument("popout");

const classes = (element: Element | null) =>
    element?.getAttribute("class")?.split(/\s+/) ?? [];

/** Every class of a family string is on the element. */
function expectFamily(element: Element | null, family: string) {
    expect(element).not.toBeNull();
    const have = classes(element);
    for (const name of family.split(/\s+/).filter(Boolean)) {
        expect(have, name).toContain(name);
    }
}

const text = (element: Element | null | undefined) =>
    element?.textContent?.trim();

@Component({
    imports: [SELECT_PARTS],
    template: `
        <button
            [kitSelectTrigger]="list"
            [(value)]="value"
            [items]="items"
            aria-label="Fruit"
            class="w-40"
        >
            <span kitSelectValue></span>
        </button>
        <ng-template #list>
            <div kitSelectContent>
                <div kitSelectItem="a">Apples</div>
                <div kitSelectItem="b">Bananas</div>
            </div>
        </ng-template>
    `,
})
class SelectHost {
    readonly items = { a: "Apples", b: "Bananas" };
    readonly value = signal<unknown>("a");
}

describe("Select", () => {
    it("is a named combobox wearing field.row, showing the chosen label", async () => {
        const { root } = await render(SelectHost);
        const trigger = root.querySelector('[role="combobox"]');
        expect(trigger?.getAttribute("aria-label")).toBe("Fruit");
        expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
        // the React kit's trigger: field.row with its own layout, and the consumer's class, merged
        expectFamily(
            trigger,
            cn(
                field.row(),
                "flex-row items-center justify-between px-3 py-2",
                "w-40",
            ),
        );
        expect(text(trigger)).toBe("Apples");
    });

    it("opens its options in the trigger's document, and picks one", async () => {
        const { doc, root, fixture, stable } = await render(
            SelectHost,
            popout(),
        );
        const trigger = root.querySelector<HTMLElement>('[role="combobox"]');
        trigger?.click();
        await stable();
        expect(trigger?.getAttribute("aria-expanded")).toBe("true");
        const list = doc.querySelector('[role="listbox"]');
        expectFamily(list, popup.content());
        expect(list?.hasAttribute("data-open")).toBe(true);
        const options = [
            ...doc.querySelectorAll<HTMLElement>('[role="option"]'),
        ];
        expect(options.map(text)).toEqual(["Apples", "Bananas"]);
        expectFamily(options[0] ?? null, menu.selectableItem());
        expect(options[0]?.hasAttribute("data-selected")).toBe(true);
        expect(document.querySelector('[role="listbox"]')).toBeNull();

        options[1]?.click();
        await stable();
        await stable();
        expect(fixture.componentInstance.value()).toBe("b");
        expect(doc.querySelector('[role="listbox"]')).toBeNull();
        expect(text(trigger)).toBe("Bananas");
    });
});

@Component({
    imports: [DROPDOWN_MENU],
    template: `
        <button [kitDropdownMenuTrigger]="menu" aria-label="Add a tab">+</button>
        <ng-template #menu>
            <div kitDropdownMenuContent align="end">
                <div kitDropdownMenuLabel>Palette</div>
                <div kitDropdownMenuItem (select)="picked.set('Blue')">Blue</div>
                <div kitDropdownMenuSeparator></div>
                <div kitDropdownMenuItem disabled>Rose</div>
                <div kitDropdownMenuRadioGroup [(value)]="palette">
                    <div kitDropdownMenuRadioItem="green">Green</div>
                    <div kitDropdownMenuRadioItem="surface">Surface</div>
                </div>
            </div>
        </ng-template>
    `,
})
class DropdownHost {
    readonly picked = signal<string | undefined>(undefined);
    readonly palette = signal("surface");
}

describe("DropdownMenu", () => {
    it("has a named trigger that says it opens a menu", async () => {
        const { root } = await render(DropdownHost);
        const trigger = root.querySelector('[aria-label="Add a tab"]');
        expect(trigger?.getAttribute("aria-haspopup")).toBe("menu");
        expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    });

    it("opens a menu of items in the trigger's document, and runs the picked one", async () => {
        const { doc, root, fixture, stable } = await render(
            DropdownHost,
            popout(),
        );
        root.querySelector<HTMLElement>('[aria-label="Add a tab"]')?.click();
        await stable();
        const list = doc.querySelector('[role="menu"]');
        expectFamily(list, popup.content());
        const items = [
            ...doc.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ];
        expect(items.map(text)).toEqual(["Blue", "Rose"]);
        expectFamily(items[0] ?? null, menu.item());
        expect(items[1]?.hasAttribute("data-disabled")).toBe(true);
        expect(items[1]?.getAttribute("aria-disabled")).toBe("true");
        const radios = [
            ...doc.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
        ];
        expect(
            radios.map((radio) => radio.getAttribute("aria-checked")),
        ).toEqual(["false", "true"]);
        expect(document.querySelector('[role="menu"]')).toBeNull();

        items[0]?.click();
        await stable();
        await stable();
        expect(fixture.componentInstance.picked()).toBe("Blue");
        expect(doc.querySelector('[role="menu"]')).toBeNull();
    });

    it("checks the picked radio item", async () => {
        const { doc, root, fixture, stable } = await render(DropdownHost);
        root.querySelector<HTMLElement>('[aria-label="Add a tab"]')?.click();
        await stable();
        doc.querySelector<HTMLElement>('[role="menuitemradio"]')?.click();
        await stable();
        expect(fixture.componentInstance.palette()).toBe("green");
    });

    it("closes on Escape", async () => {
        const { doc, root, stable } = await render(DropdownHost, popout());
        root.querySelector<HTMLElement>('[aria-label="Add a tab"]')?.click();
        await stable();
        expect(doc.querySelector('[role="menu"]')).not.toBeNull();
        doc.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await stable();
        expect(doc.querySelector('[role="menu"]')).toBeNull();
    });
});

@Component({
    imports: [CONTEXT_MENU],
    template: `
        <div [kitContextMenuTrigger]="menu" (openChange)="opened.set($event)" data-testid="area">
            Tab
        </div>
        <ng-template #menu>
            <div kitContextMenuContent>
                <div kitContextMenuItem>Close</div>
                <div kitContextMenuSeparator></div>
                <div kitContextMenuItem>Rename</div>
            </div>
        </ng-template>
    `,
})
class ContextMenuHost {
    readonly opened = signal(false);
}

describe("ContextMenu", () => {
    it("opens on a right click, in the trigger's document", async () => {
        const { doc, root, fixture, stable } = await render(
            ContextMenuHost,
            popout(),
        );
        const area = root.querySelector('[data-testid="area"]');
        area?.dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        await stable();
        expect(fixture.componentInstance.opened()).toBe(true);
        const items = [...doc.querySelectorAll('[role="menuitem"]')];
        expect(items.map(text)).toEqual(["Close", "Rename"]);
        expect(doc.querySelector('[role="separator"]')).not.toBeNull();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        // a press outside closes it
        doc.body.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
        );
        await stable();
        expect(doc.querySelector('[role="menu"]')).toBeNull();
        expect(fixture.componentInstance.opened()).toBe(false);
    });
});

@Component({
    imports: [TOOLTIP],
    template: `
        <button [kitTooltipTrigger]="tip" [delay]="0" aria-label="Locked region">L</button>
        <ng-template #tip><div kitTooltipContent>Locked by policy</div></ng-template>
    `,
})
class TooltipHost {}

describe("Tooltip", () => {
    it("shows its content as a tooltip in the trigger's document", async () => {
        const { doc, root, stable } = await render(TooltipHost, popout());
        const trigger = root.querySelector('[aria-label="Locked region"]');
        trigger?.dispatchEvent(
            new PointerEvent("pointerenter", { pointerType: "mouse" }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        await stable();
        const tooltip = doc.querySelector('[role="tooltip"]');
        expect(text(tooltip)).toBe("Locked by policy");
        expectFamily(tooltip, popup.tooltip());
        expect(document.querySelector('[role="tooltip"]')).toBeNull();
        trigger?.dispatchEvent(new PointerEvent("pointerleave"));
        await stable();
        expect(doc.querySelector('[role="tooltip"]')).toBeNull();
    });
});

@Component({
    imports: [SWITCH],
    template: `<button kitSwitch [(checked)]="on" aria-label="Veto"><span kitSwitchThumb></span></button>`,
})
class SwitchHost {
    readonly on = signal(true);
}

describe("Switch", () => {
    it("is a named switch whose checked state is data-checked, as Base UI's", async () => {
        const { root, fixture, stable } = await render(SwitchHost);
        const control = root.querySelector('[role="switch"]') as HTMLElement;
        expect(control.getAttribute("aria-label")).toBe("Veto");
        expect(control.getAttribute("aria-checked")).toBe("true");
        expect(control.hasAttribute("data-checked")).toBe(true);
        control.click();
        await stable();
        expect(fixture.componentInstance.on()).toBe(false);
        expect(control.getAttribute("aria-checked")).toBe("false");
        expect(control.hasAttribute("data-checked")).toBe(false);
        expect(
            root
                .querySelector('[data-slot="switch-thumb"]')
                ?.hasAttribute("data-checked"),
        ).toBe(false);
    });
});

@Component({
    imports: [PROGRESS],
    template: `
        <div kitProgress [value]="40" aria-label="api CPU">
            <div kitProgressTrack><div kitProgressIndicator></div></div>
        </div>
    `,
})
class ProgressHost {}

describe("Progress", () => {
    it("is a named progressbar whose indicator fills to the value", async () => {
        const { root } = await render(ProgressHost);
        const bar = root.querySelector('[role="progressbar"]');
        expect(bar?.getAttribute("aria-label")).toBe("api CPU");
        expect(bar?.getAttribute("aria-valuenow")).toBe("40");
        expectFamily(
            root.querySelector('[data-slot="progress-track"]'),
            track.rail(),
        );
        const indicator = root.querySelector(
            '[data-slot="progress-indicator"]',
        ) as HTMLElement;
        expectFamily(indicator, track.fill());
        expect(indicator.style.width).toBe("40%");
    });
});

@Component({
    imports: [ALERT_DIALOG, ClickableButton],
    template: `
        <ng-template [kitAlertDialog]="open()" (openChange)="open.set($event)">
            <div kitAlertDialogBackdrop></div>
            <div kitAlertDialogContent>
                <div kitAlertDialogHeader>
                    <h2 kitAlertDialogTitle>Save changes?</h2>
                    <p kitAlertDialogDescription>Your changes will be lost.</p>
                </div>
                <div kitAlertDialogFooter>
                    <button kitClickable size="sm">Save</button>
                </div>
            </div>
        </ng-template>
    `,
})
class AlertDialogHost {
    readonly open = signal(true);
}

describe("AlertDialog", () => {
    it("is an alertdialog named by its title and described by its description", async () => {
        const { doc, fixture, stable } = await render(AlertDialogHost);
        const dialog = doc.querySelector('[role="alertdialog"]');
        const title = doc.getElementById(
            dialog?.getAttribute("aria-labelledby") ?? "",
        );
        expect(text(title)).toBe("Save changes?");
        expect(title?.tagName).toBe("H2");
        const description = doc.getElementById(
            dialog?.getAttribute("aria-describedby") ?? "",
        );
        expect(text(description)).toBe("Your changes will be lost.");
        expect(text(dialog?.querySelector("button"))).toBe("Save");
        // Escape asks to close it; the input closes it
        doc.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await stable();
        expect(fixture.componentInstance.open()).toBe(false);
        expect(doc.querySelector('[role="alertdialog"]')).toBeNull();
    });
});

@Component({
    imports: [TABLE, Badge, ClickableButton, InputSimple, Chart],
    template: `
        <kit-table>
            <thead kitTableHeader><tr kitTableRow><th kitTableHead>Order</th></tr></thead>
            <tbody kitTableBody><tr kitTableRow><td kitTableCell>#1042</td></tr></tbody>
        </kit-table>
        <span kitBadge variant="solid" aria-label="3 incidents">3</span>
        <button kitClickable variant="ghost">Don't save</button>
        <kit-input-simple label="Email" type="email" />
        <kit-chart [option]="{ series: [] }" class="h-24" />
    `,
})
class NativeHost {}

describe("the native parts", () => {
    it("Table, Badge, Clickable, the simple input and the chart", async () => {
        const { root } = await render(NativeHost);
        expect(text(root.querySelector("table th"))).toBe("Order");
        expect(text(root.querySelector("table td"))).toBe("#1042");
        const badge = root.querySelector('[aria-label="3 incidents"]');
        expect(text(badge)).toBe("3");
        expectFamily(badge, "bg-palette-base");
        const button = root.querySelector("button");
        expect(button?.getAttribute("type")).toBe("button");
        expect(text(button)).toBe("Don't save");
        expectFamily(button, "bg-transparent");
        const input = root.querySelector("input") as HTMLInputElement;
        expect(input.getAttribute("type")).toBe("email");
        expect(text(input.labels?.[0])).toBe("Email");
        expectFamily(input, field.control());
        expectFamily(root.querySelector('[data-slot="chart"]'), "w-full h-24");
    });
});
