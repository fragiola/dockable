// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { elementOf, isEditable } from "../../src/dom/nodes";

describe("elementOf", () => {
    it("is the element itself, a text node's parent, or null", () => {
        const parent = document.createElement("p");
        const text = parent.appendChild(document.createTextNode("x"));
        expect(elementOf(parent)).toBe(parent);
        expect(elementOf(text)).toBe(parent);
        expect(elementOf(document.createTextNode("detached"))).toBeNull();
        expect(elementOf(window)).toBeNull();
        expect(elementOf(null)).toBeNull();
    });
});

describe("isEditable", () => {
    it("is true for inputs, text areas, selects and editable content, and what is inside them", () => {
        const select = document.createElement("select");
        const option = select.appendChild(document.createElement("option"));
        const editable = document.createElement("div");
        editable.contentEditable = "true";
        // jsdom does not compute isContentEditable
        Object.defineProperty(editable, "isContentEditable", { value: true });
        expect(isEditable(document.createElement("input"))).toBe(true);
        expect(isEditable(document.createElement("textarea"))).toBe(true);
        expect(isEditable(option)).toBe(true);
        expect(isEditable(editable)).toBe(true);
        expect(isEditable(document.createElement("div"))).toBe(false);
        expect(isEditable(null)).toBe(false);
        expect(isEditable(window)).toBe(false);
    });
});
