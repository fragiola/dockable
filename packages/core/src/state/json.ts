import type { BorderLocation } from "../geometry/dock";
import type { Rect } from "../geometry/rect";
import type {
    AnyTypes,
    BorderDataOf,
    BorderDefaults,
    ComponentOf,
    DockableTypes,
    LayoutDefaults,
    RowDataOf,
    TabDataOf,
    TabDefaults,
    TabOwnFields,
    TabsetDataOf,
    TabsetDefaults,
} from "./types";

/** `data` is optional exactly when the data type allows `undefined`. */
export type DataField<D> = undefined extends D ? { data?: D } : { data: D };

/** The fields a new tab is created with (JSON, `tab.add`, a drag source). */
export type TabInit<K extends string = string, D = unknown> = {
    /** generated when missing */
    id?: string;
    component: K;
    /** the tab's name (the app renders it; the packages never do) */
    label: string;
} & TabDefaults &
    TabOwnFields &
    DataField<D>;

/** A new tab of the registry `T`: a union over its components, so `data` is checked per component. */
export type TabInitOf<T extends DockableTypes> = {
    [K in ComponentOf<T>]: TabInit<K, TabDataOf<T, K>>;
}[ComponentOf<T>];

/** A tab in JSON: a {@link TabInit} whose `type` may be omitted. */
export type TabJson<T extends DockableTypes = AnyTypes> = TabInitOf<T> & {
    type?: "tab";
};

export interface TabsetJson<T extends DockableTypes = AnyTypes>
    extends TabsetDefaults {
    type: "tabset";
    id?: string;
    /** default 100 */
    weight?: number;
    /** default 0 (-1 when empty); clamped to the tabs */
    selected?: number;
    data?: TabsetDataOf<T>;
    children?: TabJson<T>[];
}

export interface RowJson<T extends DockableTypes = AnyTypes> {
    type: "row";
    id?: string;
    /** default 100 */
    weight?: number;
    data?: RowDataOf<T>;
    children?: (RowJson<T> | TabsetJson<T>)[];
}

export interface BorderJson<T extends DockableTypes = AnyTypes>
    extends BorderDefaults {
    type?: "border";
    /** default `border_<location>` */
    id?: string;
    location: BorderLocation;
    /** default -1 (closed) */
    selected?: number;
    show?: boolean;
    data?: BorderDataOf<T>;
    children?: TabJson<T>[];
}

export interface WindowJson<T extends DockableTypes = AnyTypes> {
    id?: string;
    /** the window's screen rect */
    rect?: Rect;
    root: RowJson<T>;
    active?: string;
    maximized?: string;
}

/** A layout document, version 1. */
export interface LayoutJson<T extends DockableTypes = AnyTypes> {
    version: 1;
    defaults?: LayoutDefaults;
    root: RowJson<T>;
    /** the main layout's active tabset */
    active?: string;
    /** the main layout's maximized tabset */
    maximized?: string;
    borders?: BorderJson<T>[];
    windows?: WindowJson<T>[];
}
