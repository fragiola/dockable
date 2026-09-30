// Ported from FlexLayout (https://github.com/caplin/FlexLayout), src/view/I18nLabel.ts.
// Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see LICENSE.
// The English defaults (I18nLabelDefaults) are deliberately not ported.

/**
 * The keys of every accessible name or label a view built on the core may need. There are no
 * default strings: the consumer resolves a key to text (for example through `getLabel(key)` on
 * the React `Dockable.Root`). A `?` in a key marks where a count is substituted.
 */
export enum DockableLabel {
    /** the close button tooltip on a tab */
    Close_Tab = "dockable.close.tab",
    /** the pin indicator tooltip on a pinned tab, and the "(Pinned)" suffix added to its accessible name */
    Pinned_Tab = "dockable.pinned.tab",
    /** the aria-label of the inline tab rename textbox */
    Rename_Tab = "dockable.rename.tab",
    /** the tabset close button tooltip */
    Close_Tabset = "dockable.close.tabset",
    /** the active tabset indicator icon tooltip */
    Active_Tabset = "dockable.active.tabset",
    /** the drag image text shown while dragging a tabset */
    Move_Tabset = "dockable.move.tabset",
    /** the drag image text shown while dragging multiple tabs ("?" is replaced with the tab count) */
    Move_Tabs = "dockable.move.tabs (?)",
    /** the tabset maximize button tooltip */
    Maximize = "dockable.maximize.tabset",
    /** the tabset restore button tooltip */
    Restore = "dockable.restore.tabset",
    /** the button that pops the selected tab (or tabset) out into a window */
    Popout_Tab = "dockable.popout.tab",
    /** the button that docks a popped out tab (or tabset) back into the main layout */
    Dock_To_Layout = "dockable.dock.to.layout",
    /** the overflow button tooltip and the overflow menu's accessible name */
    Overflow_Menu_Tooltip = "dockable.overflow.menu.tooltip",
    /** the splitter's aria-label */
    Splitter = "dockable.splitter",
    /** the error boundary message shown when a tab's component fails to render */
    Error_rendering_component = "dockable.error.rendering.component",
    /** the error boundary retry button label */
    Error_rendering_component_retry = "dockable.error.rendering.component.retry",
    /** the default title for popout windows */
    Popout_Window_Name = "dockable.popout.window.name",
    /** the context menu item that starts renaming a tab */
    Menu_Rename = "dockable.menu.rename",
    /** the context menu item that pins a tab */
    Menu_Pin = "dockable.menu.pin",
    /** the context menu item that unpins a tab */
    Menu_Unpin = "dockable.menu.unpin",
    /** the context menu item that pops a tab out into a native window */
    Menu_Popout = "dockable.menu.popout",
    /** the tabset context menu item that pops the whole tabset out into a native window */
    Menu_Popout_Tabset = "dockable.menu.popout.tabset",
    /** the tabset context menu item that maximizes the tabset */
    Menu_Maximize = "dockable.menu.maximize",
    /** the tabset context menu item that restores a maximized tabset */
    Menu_Restore = "dockable.menu.restore",
    /** the border context menu item that switches the border to overlay type */
    Menu_Overlay = "dockable.menu.overlay",
    /** the border context menu item that switches the border to split type */
    Menu_Split = "dockable.menu.split",
    /** the context menu item that closes every closeable tab in the parent */
    Menu_Close_All = "dockable.menu.close.all",
    /** the context menu item that closes the closeable tabs to the right of the tab */
    Menu_Close_Right = "dockable.menu.close.right",
    /** the context menu item that closes every closeable tab but the tab itself */
    Menu_Close_Others = "dockable.menu.close.others",
}
