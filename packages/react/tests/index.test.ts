import { Model } from "@fragiola/dockable";
import { describe, expect, it } from "vitest";

describe("@fragiola/dockable-react", () => {
    it("resolves the core package", () => {
        expect(typeof Model.fromJson).toBe("function");
    });
});
