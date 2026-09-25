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
    /** the drag image text shown while dragging a group ("?" is replaced with the tab count) */
    Move_Group = "dockable.move.group (?)",
    /** the tabset maximize button tooltip */
    Maximize = "dockable.maximize.tabset",
    /** the tabset restore button tooltip */
    Restore = "dockable.restore.tabset",
    /** the toolbar button tooltip that pops the selected tab out into a native window */
    Popout_Tab = "dockable.popout.tab",
    /** the toolbar button tooltip that pops the selected tab out into a floating panel */
    Popout_Tab_Float = "dockable.popout.tab.float",
    /** the floating panel header button tooltip that pops the panel out into a native window */
    Popout_Float_To_Window = "dockable.popout.float.to.window",
    /** the floating panel header drag handle tooltip and its drag image text */
    Dock_Float_To_Layout = "dockable.dock.float.to.layout",
    /** the drag image text shown while docking a floating panel ("?" is replaced with the number of tabs) */
    Dock_Float_Tabs = "dockable.dock.float.tabs (?)",
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
    /** the context menu item that pops a tab out into a floating panel */
    Menu_Float = "dockable.menu.float",
    /** the tabset context menu item that pops the whole tabset out into a native window */
    Menu_Popout_Tabset = "dockable.menu.popout.tabset",
    /** the tabset context menu item that pops the whole tabset out into a floating panel */
    Menu_Float_Tabset = "dockable.menu.float.tabset",
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
    /** the context menu item that adds the tab to a new group */
    Menu_Add_To_New_Group = "dockable.menu.add.to.new.group",
    /** the context menu item that adds the tab to an existing group */
    Menu_Add_To_Group = "dockable.menu.add.to.group",
    /** the context menu item that moves a tab out of its group */
    Menu_Remove_From_Group = "dockable.menu.remove.from.group",
    /** the context menu item that ungroups a group, moving all its tabs back into the tabset */
    Menu_Ungroup = "dockable.menu.ungroup",
    /** the context menu item that expands a collapsed group */
    Menu_Expand = "dockable.menu.expand",
    /** the context menu item that collapses an expanded group */
    Menu_Collapse = "dockable.menu.collapse",
    /** the aria-label of the inline group rename textbox */
    Rename_Group = "dockable.rename.group",
    /** the accessible name of the group color chooser */
    Group_Color = "dockable.group.color",
    /** the group pill tooltip */
    Group_Pill_Tooltip = "dockable.group.pill.tooltip",
    /** the label text next to the group rename input */
    Group_Name_Label = "dockable.group.name.label",
    /** the placeholder shown in the group rename input */
    Group_Name_Placeholder = "dockable.group.name.placeholder",
    /** the aria-label prefix for individual color swatches ("Group color 1", etc.) */
    Group_Color_N = "dockable.group.color.n",
    /** the default name for a new tab group */
    Group_Default_Name = "dockable.group.default.name",
}
