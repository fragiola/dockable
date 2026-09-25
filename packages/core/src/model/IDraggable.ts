// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/IDraggable.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

export interface IDraggable {
    /** @internal */
    isEnableDrag(): boolean;
    /** @internal */
    getName(): string | undefined;
}
