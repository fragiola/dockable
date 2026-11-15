import { createModel, type KeyMap } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { defineComponent, h, shallowRef } from "vue";
import {
    Dockable,
    render,
    renderNode,
    renderPanel,
    settle,
    type Types,
    twoTabsets,
} from "./layout";

// A compiled template's slots are stable (`_: 1`): a new key map on the root alone must still
// reach the parts that advertise its keys.
describe("a new key map", () => {
    it("updates aria-keyshortcuts and the panel's key listener, with stable slots", async () => {
        const model = createModel<Types>(structuredClone(twoTabsets));
        const keyMap = shallowRef<KeyMap | undefined>(undefined);
        await render(
            defineComponent({
                setup: () => () =>
                    h(Dockable.Root, { model, keyMap: keyMap.value }, {
                        _: 1,
                        default: () => [
                            h(Dockable.Row, null, {
                                _: 1,
                                default: ({
                                    node,
                                }: {
                                    node: Parameters<typeof renderNode>[0];
                                }) => [renderNode(node)],
                            }),
                            h(Dockable.Panels, null, {
                                _: 1,
                                default: ({
                                    tab,
                                }: {
                                    tab: Parameters<typeof renderPanel>[0];
                                }) => [renderPanel(tab)],
                            }),
                        ],
                    } as never),
            }),
        );
        const panel = () =>
            document.querySelector('[data-layout-path="/ts0/t0"]');
        const list = () =>
            document.querySelector('[data-layout-path="/ts0/tabstrip"]');
        expect(panel()?.getAttribute("aria-keyshortcuts")).toBeNull();
        keyMap.value = { focusTabToggle: "F6", focusNextTabset: "Ctrl+F6" };
        await settle();
        expect(panel()?.getAttribute("aria-keyshortcuts")).toBe("F6");
        expect(list()?.getAttribute("aria-keyshortcuts")).toBe("Control+F6");
        // the panel's listener is attached now: F6 in the panel focuses its tab
        panel()?.dispatchEvent(
            new KeyboardEvent("keydown", { key: "F6", bubbles: true }),
        );
        expect(document.activeElement?.getAttribute("data-layout-path")).toBe(
            "/ts0/tb0",
        );
    });
});
