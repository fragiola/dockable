// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), tests/setup.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
    cleanup();
});

// a test file in the node environment (server rendering) has no window to complete
if (typeof window !== "undefined") {
    // jsdom does not implement these browser APIs. Install minimal stand-ins so the primitives
    // that touch them can render under jsdom.
    if (window.matchMedia === undefined) {
        window.matchMedia = (query: string): MediaQueryList =>
            ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false,
            }) as unknown as MediaQueryList;
    }

    if (window.ResizeObserver === undefined) {
        window.ResizeObserver = class ResizeObserver {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    }

    if (window.requestAnimationFrame === undefined) {
        window.requestAnimationFrame = (cb: FrameRequestCallback) =>
            setTimeout(() => cb(performance.now()), 0) as unknown as number;
        window.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
    }

    // jsdom measures everything as 0x0, which starves the layout of any geometry: panels only
    // render once a tabset's content rect is non-empty. Report a small fixed size for every element.
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
        configurable: true,
        get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
        configurable: true,
        get: () => 0,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
        configurable: true,
        get: () => 0,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get: () => 100,
    });
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
        configurable: true,
        value: function getBoundingClientRect(this: HTMLElement) {
            // a tab button is smaller than its strip, so a few tabs fit without tab overflow; the
            // overflow trigger takes no space (jsdom lays nothing out, so the list never shrinks for it)
            const tab = this.getAttribute("role") === "tab";
            const trigger =
                this.getAttribute("data-layout-path")?.endsWith(
                    "/button/overflow",
                ) ?? false;
            const width = trigger ? 0 : tab ? 30 : 100;
            const height = tab ? 20 : 100;
            return {
                left: 0,
                top: 0,
                right: width,
                bottom: height,
                width,
                height,
                x: 0,
                y: 0,
                toJSON: () => {},
            };
        },
    });
}
