Layouts copied from FlexLayout (https://github.com/caplin/FlexLayout), `demo/public/layouts/`.
Copyright (c) 2017 Caplin Systems Ltd. MIT licence, see the repository LICENSE.
`test_three_tabs.json` drops the demo tab icon (the skeleton renders no icons).
`test_overlay.json` drops the start border's sub-layout tab (sub-layouts in tabs are not rendered yet)
and `test_border_direction.json` is copied as is. `test_autohide_borders.json` is Dockable's own:
auto-hide borders, two of them empty, for the drag reveal.

All of them are converted to Dockable's JSON v1 (`docs/engine-v2-design.md` §2 and §4): `layout`
becomes `root`, the `left`/`right` borders become `start`/`end`, a tab's and a tabset's `name` moves into its `data`, the globals become `defaults`
(`tabEnablePopout` → `defaults.tab.enablePopout`, `borderEnableAutoHide` →
`defaults.border.autoHide`), `borderType` becomes a border's `mode`, and the attributes the model
dropped (`tabEnablePin`, `tabEnableRename`, `borderEnableTabScrollbar`) are gone: nothing in the
fixtures read them.
