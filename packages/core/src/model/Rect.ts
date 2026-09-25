// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/model/Rect.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.

import type { IJsonRect } from "./IJsonModel";

/** Anything with a position and a size, such as a `DOMRect`. */
export interface IRectLike {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The structural style keys `Rect.styleWithPosition` writes. */
export interface IPositionStyle {
    left?: string;
    top?: string;
    width?: string;
    height?: string;
    position?: string;
}

export class Rect {
    static empty() {
        return new Rect(0, 0, 0, 0);
    }

    static fromJson(json: IJsonRect): Rect {
        return new Rect(json.x, json.y, json.width, json.height);
    }

    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    toJson() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    snap(round: number) {
        this.x = Math.round(this.x / round) * round;
        this.y = Math.round(this.y / round) * round;
        this.width = Math.round(this.width / round) * round;
        this.height = Math.round(this.height / round) * round;
    }

    static fromDomRect(domRect: IRectLike) {
        return new Rect(domRect.x, domRect.y, domRect.width, domRect.height);
    }

    relativeTo(r: IRectLike) {
        return new Rect(this.x - r.x, this.y - r.y, this.width, this.height);
    }

    clone() {
        return new Rect(this.x, this.y, this.width, this.height);
    }

    equals(rect: Rect | null | undefined) {
        return (
            this.x === rect?.x &&
            this.y === rect?.y &&
            this.width === rect?.width &&
            this.height === rect?.height
        );
    }

    equalsWhenRounded(rect: Rect | null | undefined) {
        if (!rect) return false;
        const epsilon = 0.5;
        return (
            Math.abs(this.x - rect.x) < epsilon &&
            Math.abs(this.y - rect.y) < epsilon &&
            Math.abs(this.width - rect.width) < epsilon &&
            Math.abs(this.height - rect.height) < epsilon
        );
    }

    getBottom() {
        return this.y + this.height;
    }

    getRight() {
        return this.x + this.width;
    }

    get bottom() {
        return this.y + this.height;
    }

    get right() {
        return this.x + this.width;
    }

    getCenter() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    positionElement(element: HTMLElement, position?: string) {
        this.styleWithPosition(element.style, position);
    }

    styleWithPosition<S extends IPositionStyle>(
        style: S,
        position = "absolute",
    ) {
        style.left = `${this.x}px`;
        style.top = `${this.y}px`;
        style.width = `${Math.max(0, this.width)}px`; // Clamp to 0 (IE fails on negative)
        style.height = `${Math.max(0, this.height)}px`;
        style.position = position;
        return style;
    }

    contains(x: number, y: number) {
        if (
            this.x <= x &&
            x <= this.getRight() &&
            this.y <= y &&
            y <= this.getBottom()
        ) {
            return true;
        } else {
            return false;
        }
    }

    centerInRect(outerRect: Rect) {
        this.x = outerRect.x + (outerRect.width - this.width) / 2;
        this.y = outerRect.y + (outerRect.height - this.height) / 2;
    }

    clamp(outerRect: Rect) {
        if (this.width > outerRect.width) {
            this.width = outerRect.width;
        }
        if (this.height > outerRect.height) {
            this.height = outerRect.height;
        }
        if (this.x < outerRect.x) {
            this.x = outerRect.x;
        }
        if (this.y < outerRect.y) {
            this.y = outerRect.y;
        }
        if (this.getRight() > outerRect.getRight()) {
            this.x = outerRect.getRight() - this.width;
        }
        if (this.getBottom() > outerRect.getBottom()) {
            this.y = outerRect.getBottom() - this.height;
        }

        if (this.x < outerRect.x) {
            this.x = outerRect.x;
        }
        if (this.y < outerRect.y) {
            this.y = outerRect.y;
        }
    }

    toString() {
        return (
            "(Rect: x=" +
            this.x +
            ", y=" +
            this.y +
            ", width=" +
            this.width +
            ", height=" +
            this.height +
            ")"
        );
    }
}
