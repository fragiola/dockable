// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Orientation.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

export class Orientation {
    static HORZ = new Orientation("horz");
    static VERT = new Orientation("vert");

    static flip(from: Orientation) {
        if (from === Orientation.HORZ) {
            return Orientation.VERT;
        } else {
            return Orientation.HORZ;
        }
    }

    /** @internal */
    private _name: string;

    /** @internal */
    private constructor(name: string) {
        this._name = name;
    }

    getName() {
        return this._name;
    }

    toString() {
        return this._name;
    }
}
