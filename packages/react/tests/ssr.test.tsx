// @vitest-environment node
// Server rendering: no DOM at all (caplin/FlexLayout#50, "document is not defined").
import { createModel } from "@fragiola/dockable";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Dockable } from "../src";
import { renderNode, renderPanel, type Types, twoTabsets } from "./layout";

describe("server rendering", () => {
    it("renders a layout to a string without a document (caplin/FlexLayout#50)", () => {
        expect(typeof document).toBe("undefined");
        expect(typeof window).toBe("undefined");
        const error = vi.spyOn(console, "error");
        const model = createModel<Types>(structuredClone(twoTabsets));
        const html = renderToString(
            <Dockable.Root model={model}>
                <Dockable.Row<Types>>{renderNode}</Dockable.Row>
                <Dockable.Panels<Types>>{renderPanel}</Dockable.Panels>
                <Dockable.DropIndicator />
            </Dockable.Root>,
        );
        expect(html).toContain('data-layout-path="/layout"');
        expect(html).toContain('data-layout-path="/ts0/tb0"');
        expect(html).toContain('data-layout-path="/ts1/tb0"');
        expect(error).not.toHaveBeenCalled();
    });
});
