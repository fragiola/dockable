// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { elementOf } from "../src/dom/nodes";

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
