import { createModel } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";

describe("@fragiola/dockable-react", () => {
    it("resolves the core package", () => {
        expect(typeof createModel).toBe("function");
    });
});
