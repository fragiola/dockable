import { createModel } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";
import { mustPath } from "./helpers";
import { renderLayout, setInput, type Types, twoTabsets } from "./layout";

describe("a new key map", () => {
    it("updates aria-keyshortcuts and the panel's key handling", async () => {
        const model = createModel<Types>(structuredClone(twoTabsets));
        const fixture = await renderLayout(model);
        expect(
            mustPath("/ts0/t0").getAttribute("aria-keyshortcuts"),
        ).toBeNull();
        await setInput(fixture, "keyMap", {
            focusTabToggle: "F6",
            focusNextTabset: "Ctrl+F6",
        });
        expect(mustPath("/ts0/t0")).toHaveAttribute("aria-keyshortcuts", "F6");
        expect(mustPath("/ts0/tabstrip")).toHaveAttribute(
            "aria-keyshortcuts",
            "Control+F6",
        );
        // F6 in the panel focuses its tab
        mustPath("/ts0/t0").dispatchEvent(
            new KeyboardEvent("keydown", { key: "F6", bubbles: true }),
        );
        expect(document.activeElement).toBe(mustPath("/ts0/tb0"));
    });
});
