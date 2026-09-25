import { describe, expect, it } from "vitest";
import { VERSION } from "../src";

describe("@fragiola/dockable-react", () => {
    it("re-exports the core version", () => {
        expect(VERSION).toBe("0.0.0");
    });
});
