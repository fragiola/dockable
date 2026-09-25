# Walking skeleton report

Epic #1 set out to cross three risky bets end to end with the smallest working surface:
an imperative core that positions panels without fighting React, `render` + `data-*` as the
whole styling contract, and popout windows with the core owning reparenting. This report
records what held, what the styled example (`apps/playground/examples/styled/`) could not
express, and what feeds the next Epics.

The styled example is built with Tailwind v4 and the vendored Fragiola palettes. It changes
**no file under `packages/`**. Every gap below was worked around in the example or left
visible, not patched in the packages.

## 1. What held

### Bet 1: an imperative core positions panels without fighting React

Held. React renders the structure. The engine measures the registered elements after each
commit and writes panel geometry directly, and React never re-renders because of a measure.

- **Unit tests.** `packages/core/tests/engine/LayoutEngine.test.ts` covers five properties:
  - panels get only `position/left/top/width/height/display`;
  - a relayout notification fires only the first time a content area gains a size;
  - adjusting weight actions write `flex-grow` directly without a re-render;
  - moveable elements survive release and re-attach with the same identity;
  - register and unregister are idempotent.
- **Component tests.** `packages/react/tests/primitives.test.tsx` checks that the only inline
  styles are structural. It also covers the StrictMode registration counts and content that
  never remounts across selection changes, tab moves, layer moves and an undo/redo model swap.
- **Playwright.** `e2e/layout.spec.ts` checks panel boxes against content-area boxes, before
  and after a window resize. `e2e/splitter.spec.ts` covers realtime and outline drags, the
  keyboard, finite weights and weight conservation at the edge. `e2e/drag.spec.ts` includes
  the ported move-position regression.
- **Styled example.** Tabsets have margins, borders and rounded corners. Panels still sit
  exactly over each content area, with no styling cooperation from the package.

### Bet 2: `render` + `data-*` expose enough state to style a real layout

Held, with the gaps listed in section 2. The whole example is styled through five
mechanisms:

- `data-*` variants (`data-selected:`, `data-active:`, `data-dragging:`,
  `data-[orientation=vertical]:`, `data-[drop-kind=…]`);
- `group-data-active:` + `in-data-selected:` for state that crosses primitives;
- `className` / `style` functions (the drop indicator switches palette by `kind` and animates
  with `tabDragSpeed`);
- `renderSplitter`;
- the consumer's own markup around the primitives (tab strip header, pop out button).

`e2e/styled.spec.ts` asserts computed values, not class names, following the fragiola/ui rule
"verify by compiling". It checks four things: the selected tab's background, the splitter's
6px thickness, the drop indicator styled differently for `rect` (solid) and `edge` (dashed)
drops, and the palette styles present in the popout.

### Bet 3: popout with the core owning reparenting

Held. `PopoutManager` (core) opens the window and mirrors styles. It creates a sub-engine per
window layout and applies the close policy. React only portals into the content root the core
provides. Moveable elements are re-parented across documents with `appendChild`.

- `packages/core/tests/popout/PopoutManager.test.ts` covers:
  - idempotent open, and a single window through a StrictMode-style release and reopen;
  - the load sequence;
  - `<link>`, `<style>`, in-place edits, CSSOM rules and `adoptedStyleSheets`;
  - both close policies and the `null`-window fallback;
  - resource release on close, reload and dispose;
  - moveable identity across documents.
- `packages/react/tests/popout.test.tsx` checks that nothing renders until the window is
  ready and that content goes into the popout document. It also shows the content keeps its
  state through pop out and dock back (mount counter at 1). `enableWindowReMount` remounts
  exactly once, and StrictMode opens one window.
- `e2e/popout.spec.ts` (Chromium) covers:
  - the port of `popout-check`;
  - counter and input state surviving pop out, in-popout dock back, and closing the window;
  - mirrored styles;
  - a single `window.open` under StrictMode.

  Style mirroring was also checked against a production build (`vite preview`, where the
  stylesheet is a `<link>`).

## 2. What was missing from the public surface

| # | Needed by the example | Workaround used | Proposed API |
|---|---|---|---|
| 1 | Show the selected tab of the **active tabset** differently (a marker). `Tab` knows `selected` but not the tabset's `active`. | `group` on `TabSet` plus `group-data-active:in-data-selected:block` on a child span. Works in Tailwind, but it is CSS nesting other styling solutions may not have. | `data-tabset-active` on `Dockable.Tab` (and `tabsetActive` in its state). |
| 2 | Panels live outside the tabset (in the panel layer), so the tabset's `border-radius`/`overflow` cannot clip them, and a panel cannot be styled by its tabset's state. | For rounded tabsets, the panel repeats the tabset's inner radius on its bottom corners (`rounded-b-[calc(var(--radius-md)-1px)]`). This duplicates a value the tabset owns and breaks if the tab strip moves to the bottom. The example now uses square, borderless tabsets, so it no longer needs it. For the same reason a tabset-level active outline (`ring`) only shows around the strip, so the example marks the active tabset on its selected tab instead. | `data-tabset` (the tabset path) and `data-tabset-active` on `Dockable.Panel`, plus the same keys in `PanelState`. |
| 3 | The popout document needs the page's **root attributes and body classes**. The palettes key off `:root[data-theme]` and `body.palette-surface`. The core copies only `lang` and `dir`. | `Dockable.Popout onOpen` copies `data-theme` and adds the body class. | A `PopoutManager` option `mirrorRoot?: boolean \| { attributes: string[] }` that copies the listed `<html>`/`<body>` attributes and keeps them in sync with a MutationObserver. |
| 4 | Flipping `dir` at runtime (RTL toggle) moves every tabset without resizing any, so the engine's ResizeObservers never fire and **panels stay at their LTR positions**. | The example calls `engine.sync()` after setting `dir`. | The engine observes `dir`/`lang` on the root's document element (and on the root) with a MutationObserver and re-syncs. Also document `engine.sync()` as the manual escape hatch. |
| 5 | In **RTL, splitter drags and keyboard resizing are wrong**: a drag jumps the first tabset to full width and arrows do nothing. Edge and side drops are physical as well (`left` docks before, whichever side that renders on). The core's split math (`getSplitterInitials`/`calculateSplit`) and `DockLocation` assume physical left-to-right child order. | None. RTL only renders correctly. | The core reads the row's computed `direction`. `SplitterController` and `RowNode.calculateSplit` mirror positions in RTL, and drop locations get logical names (`start`/`end`) on the indicator state (`data-drop-location="start"`). |
| 6 | Style **every splitter** the same way. The default `Dockable.Splitter` is unstyled, and a custom one needs `renderSplitter` on every `Row` (root, nested, and in `Popout`). | `renderSplitter` passed to every `Row`. | A `renderSplitter` / `splitterProps` default on `Dockable.Root` (context) that nested rows and popouts inherit. |
| 7 | A **pop out button** for the selected tab of a tabset. `data-popout-enabled` exists on `Tab` only. The button needs the selected tab, its `enablePopout` and `supportsPopout`. | The button reads `tabset.getSelectedNode()?.isEnablePopout()` and `mainEngine.isSupportsPopout()`. | A `Dockable.PopoutTrigger` part (a button primitive taking `children`, hidden when unavailable), or `data-popout-enabled` on `TabSet` for its selected tab. |
| 8 | A **drop-target highlight on the tabset** under the pointer (not only the outline). | Not needed for the skeleton. The outline alone is enough. | `data-drop-target` and `data-drop-location` on the `TabSet` currently targeted. |
| 9 | A wider splitter **hit area** than its visible thickness (a 1px line that is easy to grab). | Done in the example, VS Code style: a 1px splitter with a centred 6px `::after` grab area, filled as a band only while `data-dragging` (or on keyboard focus). It needs `relative z-10` to stay above the tabsets and panels it overlaps. The engine measures the element (1px), so the split math is unaffected. | Document the pseudo-element pattern; optionally a `Dockable.SplitterHandle` part. |
| 10 | Drops **before the first tab** are rejected when that tab is flush with the tabset's edge (`StripDrop`'s `restrictAtStripStart`: the edge belongs to the tabset's side drop). FlexLayout's theme pads the strip. | The fixture and example pad the tab list (`ps-2`). | Document it on `Dockable.TabList`, or relax the restriction when the strip has its own start padding. |
| 11 | A thin tab strip at the top of the layout falls inside the **10px top-edge docking band** at the layout's centre, so a drop aimed at the strip docks to the layout edge. | The fixture gives tab lists a 30px minimum height, as FlexLayout's theme does. | An `edgeDockMargin` model attribute, or edge docking only through `Dockable.EdgeIndicator` targets (next slice). |
| 12 | The **drop indicator painted under the panels**. Panels are portalled into the root after its other children, and absolutely positioned siblings with no `z-index` paint in DOM order. | `z-10` on the indicator (and `z-index: 10` in the fixture CSS). | A documented stacking order, or a `data-dockable-layer` on the panel layer so consumers can target it; alternatively render panels into a dedicated layer element placed before the root's other children. |

Things that turned out **not** to be missing:

- first and last tab styling (`first:`/`last:` work, since tabs are siblings);
- a tabset "has focus" state (`focus-within:`);
- an empty-strip marker (`data-empty` exists);
- a drag preview (the browser snapshot of the styled tab is fine for the skeleton);
- weights as CSS variables (nothing in the example animated them).

## 3. What was awkward

- **Children-function verbosity.** The recursion (`renderNode`: `TabSet` › header › `TabList`
  › `Tab`, `TabSetContent`, else a nested `Row`) is about 40 lines. It is written once, but
  `Popout` must receive it again, and every `Row` needs `renderSplitter`. A shared "layout
  template" (context default) would remove the repetition without taking the recursion away
  from the developer.
- **`renderSplitter` defaults.** The default splitter is correct but invisible until styled,
  and the only way to style all of them is to pass `renderSplitter` everywhere (gap 6).
- **`getLabel`.** Only the splitter's accessible name uses it in the skeleton. The keys are
  enum values (`dockable.splitter`), so a consumer writes a `Partial<Record<DockableLabel,
  string>>` map. That is fine, but the map must be kept complete by hand as parts add keys.
- **Sizing.** `Dockable.Root` has no intrinsic size: the consumer must size it (flex or
  height). That is intended but easy to miss: an unsized root renders nothing visible.
- **Tab location.** `TabSet` forces `flex-direction: column` (structural), so a bottom tab
  strip means ordering the markup (`TabSetContent` before the strip), not a style.
- **Popout theming.** Everything that makes the page look right (root attributes, body
  classes) has to be repeated by hand for the popout document (gap 3).

## 4. Deviations from FlexLayout made during the Epic

- **Model tests (#3).**
  - `GroupedTabs` "defaults name…" asserts the raw `DockableLabel.Group_Default_Name` key
    instead of calling `setI18nDefaults` (D3).
  - `Rect` "builds from an element's getBoundingClientRect" is gone: `Rect` no longer reads
    the DOM. Measurement is the engine's injectable `measure`, tested in
    `LayoutEngine.test.ts`.
  - `Model` "restores horizontal scroll…" moved to a jsdom test with a layout controller,
    since the moveable element comes from the controller.
  - No test asserted `DropInfo.className`, so D6 needed no assertion edits.
  - Every other change is `import`/`import type`, explicit vitest imports, or bounded `!` in
    test code.
- **Defaults (D3).** The tab name default is `""` instead of `"[Unnamed Tab]"`. The group
  default name is the `DockableLabel.Group_Default_Name` key.
- **Popout close policy.** It defaults to `"dock"`: tabs move back to the main layout.
  FlexLayout's `closePopout` float conversion exists as the `"float"` policy (tested), and the
  float slice flips the default.
- **New parts.** `TabSetContent` (the measured content area) and `Panels` (the panel layer)
  are parts FlexLayout does not have as such.
- **Splitter preview.** It is computed arithmetically (`previewOffset`) and rendered as a
  structural `transform` on the splitter itself. There is no outline div and no read-back.
- **Splitter behaviour (review fixes).**
  - A press without movement commits nothing; FlexLayout commits the unchanged split.
  - Only the primary button starts a drag.
  - A drag follows only its own pointer.
  - A moved realtime drag interrupted by unmount commits.
- **UndoManager (review fix).** An ignored action in the middle of a gesture no longer drops
  the pre-gesture snapshot, and undo/redo clears a pending one.
- **Dropped drags.** External drags and "add" drags (`DragSource.External`/`Add`,
  `addTabWithDragAndDrop`, `onExternalDrag`) are not ported. Neither is the overlay-border
  reveal during a drag (borders slice).
- **Drop indicator.** It is state, not a classed div. `Dockable.DropIndicator` sets
  `pointer-events: none` itself: an indicator under the pointer would take the drag's
  enter/leave events and make the browser cancel the drop (FlexLayout does this in its theme
  CSS).
- **Popouts and the main page unload.** Popouts close on the main window's `pagehide`
  rather than `beforeunload`, since another handler can still cancel the unload. When a
  swapped-in model reopens a named popout window, ownership passes to the new manager, so the
  old one neither closes the window nor applies its close policy.
- **Lost-drag guard.** FlexLayout only names this fallback in a comment. Here a drag ends on
  a `dragend` anywhere in the document, a pointer move with no button held, or a new press.
- **Native drag listeners.** They are attached by the core engine to its root rather than by
  the React `Root`, so popouts and future adapters get them for free.
- **`data-layout-path` additions.** Paths FlexLayout does not have: `/layout` (Root), `/row`
  (root row), `…/content` (TabSetContent), `/outline` (DropIndicator).
- **Tooling.** The JSON interface generator formats with Biome and loads the model through
  Vite's module runner (Node's own type stripping cannot resolve the extensionless imports).
- **Playwright helpers.** Drags end with a 1px nudge at the target: in Chromium's drag
  emulation a step that crosses into another element can fire only `dragenter`/`dragleave`,
  leaving the last `dragover` behind the pointer. Edge drags aim at the layout edge directly,
  since there are no edge indicator elements yet.

## 5. Input for the next Epics

1. **Borders, overlay and maximize.**
   - `Dockable.Border` and the maximize primitive.
   - The border splitter path is already in `SplitterController` (ARIA in px, keyboard), and
     the engine already measures `borderheader`/`bordercontent`.
   - Port the overlay reveal during drags (`checkForBorderToShow`).
   - Take gap 8 (drop-target highlight) and gap 11 (edge band) here, together with
     `Dockable.EdgeIndicator`.
2. **Tab overflow and groups.** `TabOverflowHook`, `Dockable.OverflowTrigger`, and group pills.
   The engine already measures `grouppill`/`groupendmarker`. Gap 10 (strip-start drops)
   belongs here.
3. **Float windows.** `Dockable.Float`: the engine's `updateRect` already looks for
   `data-dockable-float`, and the drag manager already has the float branch
   (`startDockLayoutDrag`). Flip the popout close policy default to `"float"`.
   Known limitation until then: a window layout can end up with no window and no renderer.
   With the `"float"` policy, a closed popout becomes a float, which this slice does not
   render. With `"dock"`, the same happens when `onAction` vetoes the dock-back moves. Either
   way its tabs are unreachable. The float slice must render floats and decide what a vetoed
   dock-back does.
4. **Full popout.**
   - Dragging between windows (the static `DragState` is already shared) and popout of whole
     tabsets.
   - Gap 3 (root attribute mirroring) and gap 7 (`PopoutTrigger`).
   - The remaining `popout-*` Playwright specs.
5. **Playwright suite.** Port the rest of `tests-playwright/` against `data-layout-path`. Keep
   the 1px nudge in the drag helpers.

Cross-cutting, to schedule before any slice declares RTL support:

- gaps 4 and 5 (re-measure on direction change, logical splitter and drop math);
- gaps 1, 2 and 6 (tabset state on `Tab`/`Panel`, and splitter defaults from `Root`).
