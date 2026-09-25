// Adapted from FlexLayout (https://github.com/caplin/FlexLayout), tests/setup.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
    cleanup();
});

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
    value: function getBoundingClientRect() {
        return {
            left: 0,
            top: 0,
            right: 100,
            bottom: 100,
            width: 100,
            height: 100,
            x: 0,
            y: 0,
            toJSON: () => {},
        };
    },
});
