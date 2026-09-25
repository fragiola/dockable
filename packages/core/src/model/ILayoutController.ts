// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/ILayoutController.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import type { Model } from "./Model";
import type { Rect } from "./Rect";

/**
 * Minimal view-side contract required by the model layer. Implemented by
 * LayoutController; declared here so src/model has no dependency on src/view.
 *
 * @internal
 */
export interface ILayoutController {
    getCurrentWindow(): Window | undefined;
    getWindowId(): string | undefined;
    getModel(): Model;
    getDomRect(): Rect;
    getLayoutRef(): HTMLElement | null;
    /**
     * Create the element that hosts a tab's content. It is re-parented (never cloned) between
     * panels, windows and documents, so the content keeps its state. Called lazily, so the model
     * never needs a DOM to load.
     */
    createMoveableElement(): HTMLElement;
}
