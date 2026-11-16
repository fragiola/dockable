import {
    Directive,
    inject,
    input,
    TemplateRef,
    ViewContainerRef,
} from "@angular/core";
import type {
    AnyTypes,
    BorderNode,
    DockableTypes,
    Model,
    RowNode,
    TabOf,
    TabsetNode,
} from "@fragiola/dockable";

/**
 * What types a template directive's context: nothing (`<ng-template dockableRowChild let-node>`,
 * any registry), or the model (`<ng-template [dockableRowChild]="model" let-node>`), whose
 * registry types the nodes it hands to the template (`tab.data` narrows on `tab.component`).
 */
export type TypedBy<T extends DockableTypes> = Model<T> | "" | undefined;

/** The context of a `[dockableRow]`'s child template. */
export interface RowChildContext<T extends DockableTypes = AnyTypes> {
    /** the child: a tabset or a nested row (`let-node`) */
    $implicit: TabsetNode<T> | RowNode<T>;
    /** the same child (`let-node="node"`) */
    node: TabsetNode<T> | RowNode<T>;
}

/**
 * Renders each child of the enclosing `[dockableRow]`: a tabset or a nested row. Place it directly
 * inside the row's element: `<ng-template dockableRowChild let-node>`.
 */
@Directive({ selector: "ng-template[dockableRowChild]" })
export class DockableRowChild<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's nodes by its registry (optional) */
    readonly dockableRowChild = input<TypedBy<T>>(undefined);
    readonly template = inject<TemplateRef<RowChildContext<T>>>(TemplateRef);
    readonly viewContainer = inject(ViewContainerRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableRowChild<T>,
        _context: unknown,
    ): _context is RowChildContext<T> {
        return true;
    }
}

/** What a splitter a row inserts is: the row it resizes, and the child it sits before. */
export interface RowSplitterProps<T extends DockableTypes = AnyTypes> {
    /** the row the splitter resizes */
    node: RowNode<T>;
    /** the splitter sits before child `index` (1-based) */
    index: number;
}

/** The context of a `[dockableRow]`'s splitter template. */
export interface RowSplitterContext<T extends DockableTypes = AnyTypes> {
    /** the splitter's `{ node, index }` (`let-splitter`) */
    $implicit: RowSplitterProps<T>;
    node: RowNode<T>;
    index: number;
}

/**
 * Renders the splitter the enclosing `[dockableRow]` inserts between two children (by default a
 * bare `[dockableSplitter]` element). Place it directly inside the row's element:
 * `<ng-template dockableRowSplitter let-node="node" let-index="index"><div [dockableSplitter]="node"
 * [index]="index" aria-label="Resize"></div></ng-template>`.
 */
@Directive({ selector: "ng-template[dockableRowSplitter]" })
export class DockableRowSplitter<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's nodes by its registry (optional) */
    readonly dockableRowSplitter = input<TypedBy<T>>(undefined);
    readonly template = inject<TemplateRef<RowSplitterContext<T>>>(TemplateRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableRowSplitter<T>,
        _context: unknown,
    ): _context is RowSplitterContext<T> {
        return true;
    }
}

/** The context of a `[dockableTabList]`'s tab template. */
export interface TabListItemContext<T extends DockableTypes = AnyTypes> {
    /** the tab (`let-tab`) */
    $implicit: TabOf<T>;
    tab: TabOf<T>;
}

/**
 * Renders a tab button (a `[dockableTab]`) for each tab of the enclosing `[dockableTabList]`.
 * Place it directly inside the list's element: `<ng-template dockableTabListItem let-tab>`.
 */
@Directive({ selector: "ng-template[dockableTabListItem]" })
export class DockableTabListItem<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's tabs by its registry (optional) */
    readonly dockableTabListItem = input<TypedBy<T>>(undefined);
    readonly template = inject<TemplateRef<TabListItemContext<T>>>(TemplateRef);
    readonly viewContainer = inject(ViewContainerRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableTabListItem<T>,
        _context: unknown,
    ): _context is TabListItemContext<T> {
        return true;
    }
}

/** The context of the `[dockableBorders]` templates. */
export interface BorderTemplateContext<T extends DockableTypes = AnyTypes> {
    /** the border (`let-border`) */
    $implicit: BorderNode<T>;
    border: BorderNode<T>;
}

/**
 * Renders a border's strip (a `[dockableBorder]`) for each border the enclosing
 * `[dockableBorders]` shows. Place it directly inside the frame's element:
 * `<ng-template dockableBordersBar let-border>`.
 */
@Directive({ selector: "ng-template[dockableBordersBar]" })
export class DockableBordersBar<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's borders by its registry (optional) */
    readonly dockableBordersBar = input<TypedBy<T>>(undefined);
    readonly template =
        inject<TemplateRef<BorderTemplateContext<T>>>(TemplateRef);
    readonly viewContainer = inject(ViewContainerRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableBordersBar<T>,
        _context: unknown,
    ): _context is BorderTemplateContext<T> {
        return true;
    }
}

/**
 * Renders a border's panel area for each border the enclosing `[dockableBorders]` shows (by
 * default a bare `[dockableBorderContent]` element). Place it directly inside the frame's element:
 * `<ng-template dockableBordersContent let-border>`.
 */
@Directive({ selector: "ng-template[dockableBordersContent]" })
export class DockableBordersContent<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's borders by its registry (optional) */
    readonly dockableBordersContent = input<TypedBy<T>>(undefined);
    readonly template =
        inject<TemplateRef<BorderTemplateContext<T>>>(TemplateRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableBordersContent<T>,
        _context: unknown,
    ): _context is BorderTemplateContext<T> {
        return true;
    }
}

/** The context of a `[dockableBorderContent]`'s splitter template. */
export interface BorderSplitterContext<T extends DockableTypes = AnyTypes> {
    /** the border the splitter resizes (`let-node`) */
    $implicit: BorderNode<T>;
    node: BorderNode<T>;
}

/**
 * Renders the splitter of the enclosing `[dockableBorderContent]` (by default a bare
 * `[dockableSplitter]` element). Place it directly inside the content's element:
 * `<ng-template dockableBorderSplitter let-node><div [dockableSplitter]="node"
 * aria-label="Resize"></div></ng-template>`.
 */
@Directive({ selector: "ng-template[dockableBorderSplitter]" })
export class DockableBorderSplitter<T extends DockableTypes = AnyTypes> {
    /** the model, to type the template's border by its registry (optional) */
    readonly dockableBorderSplitter = input<TypedBy<T>>(undefined);
    readonly template =
        inject<TemplateRef<BorderSplitterContext<T>>>(TemplateRef);
    readonly viewContainer = inject(ViewContainerRef);

    static ngTemplateContextGuard<T extends DockableTypes>(
        _directive: DockableBorderSplitter<T>,
        _context: unknown,
    ): _context is BorderSplitterContext<T> {
        return true;
    }
}
