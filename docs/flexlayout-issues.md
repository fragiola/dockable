# FlexLayout issues: what developers report, and what Dockable does about it

This report surveys the issue tracker of [caplin/FlexLayout](https://github.com/caplin/FlexLayout),
the library Dockable was ported from, and records what Dockable does about each recurring problem.
Every concrete bug Dockable claims to avoid has a regression test named after the issue
(`caplin/FlexLayout#<n>`); the [regression matrix](#regression-matrix) maps each one to its test.
Dockable's design record is [`engine-v2-design.md`](./engine-v2-design.md), and what it does not
do yet is listed, from the docs' side, in
[`site/docs/limitations.mdx`](../site/docs/limitations.mdx).

The survey was taken on 2026-09-30 against the source of `flexlayout-react` 0.11.0
(`../FlexLayout`, read-only). The issue states and the stats below were fetched again on
2026-10-02, and the verdicts describe Dockable's code as of that date.

## Stats

- The tracker holds **288 issues**: 133 open and 155 closed. Of the closed ones, 133 were closed as
  completed and 22 as "not planned" by the stale bot. On 2026-10-02 the bot closed
  [#486](https://github.com/caplin/FlexLayout/issues/486), [#494](https://github.com/caplin/FlexLayout/issues/494), [#496](https://github.com/caplin/FlexLayout/issues/496), [#497](https://github.com/caplin/FlexLayout/issues/497), [#498](https://github.com/caplin/FlexLayout/issues/498), [#501](https://github.com/caplin/FlexLayout/issues/501), [#504](https://github.com/caplin/FlexLayout/issues/504) and [#511](https://github.com/caplin/FlexLayout/issues/511) as not planned.
  (GitHub's issue list and search count 287 and 132 open: they miss
  [#319](https://github.com/caplin/FlexLayout/issues/319), which is open.)
- **139 issues carry the `stale` label** (114 open, 25 closed). "Stale" means nobody answered, not
  that the problem went away: a closed stale issue was closed for silence, not fixed.
- "Open" overstates what is unresolved. These issues are fixed in the 0.11.0 source but were never
  closed: [#32](https://github.com/caplin/FlexLayout/issues/32), [#47](https://github.com/caplin/FlexLayout/issues/47), [#48](https://github.com/caplin/FlexLayout/issues/48), [#99](https://github.com/caplin/FlexLayout/issues/99), [#212](https://github.com/caplin/FlexLayout/issues/212), [#275](https://github.com/caplin/FlexLayout/issues/275), [#289](https://github.com/caplin/FlexLayout/issues/289), [#310](https://github.com/caplin/FlexLayout/issues/310).
- This report cites 153 issues. 86 of them are open and 67 closed (17 of those as not
  planned); 90 carry `stale`.

## Verdicts

Each theme gets one verdict for Dockable:

- **solved**: Dockable's design removes the cause; where the bug is concrete, a test pins it.
- **addressed**: Dockable takes a concrete step, and what is left is named.
- **by design**: the behaviour is intended, or cannot arise in a headless library (no CSS, no
  text, no rendered menus); the docs say how an app changes it when it can.
- **not built**: the feature does not exist yet, and
  [`limitations.mdx`](../site/docs/limitations.mdx) lists it.

| theme | issues | verdict |
|---|---|---|
| T1 remount, state loss and re-renders on model change | 11 | solved: no view state in the model, and `layout.load` reconciles by id |
| T2 programmatic-control gaps and inconsistent actions | 18 | solved: an orthogonal command catalogue, idempotent setters, batch, a documented tidy; an empty main area is by design |
| T3 event timing, duplicates, before and after | 11 | solved: middleware before and after, one `subscribe`, one event per commit carrying the result |
| T4 untyped `config`, TypeScript quality | 8 | solved: typed `data` registry, strict nullability, no import cycles |
| T5 attribute and global-attribute confusion, docs that drift | 9 | solved: trimmed model, one defaults rule, generated command docs |
| T6 serialization and migration across versions | 6 | addressed: `version`, schema validation, `data` separate from the layout's fields |
| T7 styling and CSS lock-in | 11 | by design (headless) |
| T8 popouts | 15 | addressed: style mirroring, one window under StrictMode, an injectable window opener; libraries that use the global `document` are documented; a document hook is not built |
| T9 floats | 4 | not built |
| T10 SSR, ESM and bundling | 9 | solved: Node-loadable core, server-renderable primitives, no `crypto` needed, no ErrorBoundary |
| T11 sizing and constraints | 10 | addressed where the model owns it (min/max, root orientation); fill and fixed sizes are not built |
| T12 drag and drop interop and robustness | 13 | addressed: only Dockable's drags are claimed and content drags never are, every drop and dragend resets from the capture phase, drop policy as middleware; cross-window tab drag is not built |
| T13 accessibility and keyboard | 6 | solved: APG patterns, names from the app, a `matchesKey` that tolerates events with no key |
| T14 RTL, i18n, hard-coded text | 5 | i18n by design; RTL solved: splitters, keys, drops, borders and a runtime `dir` flip follow the direction |
| T15 tab strip, overflow, borders, menus | 17 | menus by design; overflow loops solved; several open tabs per border are not built |

## T1 Remount, state loss and re-renders on model change

The most discussed theme. FlexLayout keeps view state inside the model's nodes: `TabNode` holds the
moveable element, the scroll position and a frame handle, and `Model.fromJson(json, previous)` has
to copy that state across ("adopt") so replacing the model does not remount the content. Any app
that rebuilds the model (Redux, undo, sync) loses content or re-renders the whole layout.

- [#456](https://github.com/caplin/FlexLayout/issues/456) Will onModelChange cause all the components rendered inside the factory to be re-rendered after modifying the model? (open, stale)
- [#496](https://github.com/caplin/FlexLayout/issues/496) Too much rerender, whole FlexLayout rerender even when I perform some operation inside any tab (closed, not planned, stale)
- [#524](https://github.com/caplin/FlexLayout/issues/524) Model updates trigger unnecessary re-renders for tab components (closed)
- [#181](https://github.com/caplin/FlexLayout/issues/181) Rerender after changing tabs (open, stale)
- [#482](https://github.com/caplin/FlexLayout/issues/482) Mount/Unmount Problem when conducting Action.MOVE_NODE (closed)
- [#520](https://github.com/caplin/FlexLayout/issues/520) `Actions.addNode` causing duplicate lifecycle flow in web components (closed, stale)
- [#149](https://github.com/caplin/FlexLayout/issues/149) avoid re-render of existing tabset? (closed)
- [#121](https://github.com/caplin/FlexLayout/issues/121) Content of tabs not preserved when showing/hiding SubLayout (closed)
- [#285](https://github.com/caplin/FlexLayout/issues/285) React context is not available inside onRenderTab when dragging the tab after updating to 0.6.0 (closed)
- [#498](https://github.com/caplin/FlexLayout/issues/498) Maximum update depth exceeded (closed, not planned, stale)
- [#517](https://github.com/caplin/FlexLayout/issues/517) "Maximum update depth exceeded" if sticky buttons in TabSet is wider than 10px (closed)

**Verdict: solved.** The model holds no DOM or view state. The engine keeps moveable elements,
rects, scroll and "rendered" keyed by node id, so a new state with the same ids finds the same
elements. `layout.load` replaces the state and reconciles by id, and the engine re-renders only
what changed. React's `useModelState(selector)` re-renders a component only when its selection
changes. The two update loops of the list are pinned by tests: switching tabs across the overflow
boundary under StrictMode commits a bounded number of times and logs no error
([caplin/FlexLayout#498](https://github.com/caplin/FlexLayout/issues/498)), and tab overflow settles in a few passes even with a trigger whose width
grows with the hidden count ([caplin/FlexLayout#517](https://github.com/caplin/FlexLayout/issues/517)).

## T2 Programmatic-control gaps and inconsistent actions

Users cannot do from code what the UI does: add a tab to a border, select a border tab, add to an
empty tabset, resize a tabset, close several tabs, add a row. `Actions` has 27 types with payload
keys named `node`, `tabNode`, `tabsetNode`, `nodeId`, `fromNode`/`toNode` and `layoutId`; several
are toggles (`maximizeToggle`); and the model creates structure silently (an empty root gets a
tabset, a missing active tabset is ignored).

- [#96](https://github.com/caplin/FlexLayout/issues/96) Programmatically add tab into Border (open, stale)
- [#109](https://github.com/caplin/FlexLayout/issues/109) I Can select a tab which in a tabset  (programmatically)  but can't select a tab which in a border (programmatically) (open, stale)
- [#291](https://github.com/caplin/FlexLayout/issues/291) Cannot add tab to an empty tabset using Actions.addnode or addTabToTabset (open, stale)
- [#51](https://github.com/caplin/FlexLayout/issues/51) addTabToActiveTabSet should handle the add when active tabset was closed (open, stale)
- [#207](https://github.com/caplin/FlexLayout/issues/207) Adding/creating rows with addNode (open, stale)
- [#53](https://github.com/caplin/FlexLayout/issues/53) Add new tab after node (open, stale)
- [#155](https://github.com/caplin/FlexLayout/issues/155) Programmatically resize tabset (open, stale)
- [#395](https://github.com/caplin/FlexLayout/issues/395) Maximizing tabset through `updateNodeAttributes` doesn't work (closed)
- [#262](https://github.com/caplin/FlexLayout/issues/262) how can i  show/hide tab (open, stale)
- [#331](https://github.com/caplin/FlexLayout/issues/331) how to show/hide tabset (closed)
- [#95](https://github.com/caplin/FlexLayout/issues/95) Close multiple tabs in tabset. (open, stale)
- [#256](https://github.com/caplin/FlexLayout/issues/256) How to delete/close a TabSet? (closed)
- [#127](https://github.com/caplin/FlexLayout/issues/127) Add Tab To Sub Layout (open, stale)
- [#307](https://github.com/caplin/FlexLayout/issues/307) SelectTab does not select tab if multiple tabs are invoked (open, stale)
- [#269](https://github.com/caplin/FlexLayout/issues/269) Actions for addTabWithDragAndDrop and addTabWithDragAndDropIndirect (closed, not planned, stale)
- [#310](https://github.com/caplin/FlexLayout/issues/310) Is there a way to drag tabs/tabsets without having the tabSetStrip enabled? (open (open (fixed in 0.11.0), stale)
- [#394](https://github.com/caplin/FlexLayout/issues/394) Layout with no tabset creates a random tabset by default (open)
- [#93](https://github.com/caplin/FlexLayout/issues/93) Avoid empty canvas (open, stale)

**Verdict: solved.** One command catalogue, `<kind>.<verb>`, whose payload keys say what they take:
an id is `tabId`, `tabsetId`, `borderId`, `rowId` or `windowId`, and `to` is a placement target.
`tab.add` is flat: the new tab's fields and its placement (`to`, `location`, `index`) in one
payload. Setters are idempotent (`tabset.maximize` takes a `value`), `tab.select` works in
borders, `tab.add` and `tab.move` accept a tabset, a row, a border or a layout as `to`,
`row.resize` sets weights, and `batch` runs several commands atomically. A command that cannot
apply returns a structured error instead of doing nothing.

The model does create structure, as FlexLayout does, and says so: after every command and on load,
**tidy** removes empty rows, replaces a row of one child by that child, removes an empty tabset
that allows it (`deleteWhenEmpty` and `closable`), removes an empty window, and keeps a tabset
in the main layout. Since the fix for [caplin/FlexLayout#291](https://github.com/caplin/FlexLayout/issues/291), the main layout keeps the empty tabset it
already has, with its id, so a layout loaded with an empty tabset can receive a `tab.add` to that
id; a new tabset is made only when the main layout has none, which is by design
([caplin/FlexLayout#394](https://github.com/caplin/FlexLayout/issues/394)). Moving every tab into a border or a popout leaves that tabset empty, also by
design ([caplin/FlexLayout#93](https://github.com/caplin/FlexLayout/issues/93)): the
[restricting-drops guide](../site/docs/guides/restricting-drops.mdx#keeping-the-main-layout-filled)
shows the middleware that vetoes such a move. When the active tabset goes, `model.get("default-tabset")` answers with the layout's first
tabset, so "add to the active tabset" keeps working ([caplin/FlexLayout#51](https://github.com/caplin/FlexLayout/issues/51)).

## T3 Event timing, duplicates, before and after

`onModelChange` fires twice, fires late, fires before the view settled, or cannot tell the app what
the action returned (the id of a new tabset). There is no "before" hook apart from `onAction`, which
a direct `model.doAction` bypasses.

- [#513](https://github.com/caplin/FlexLayout/issues/513) When calling model.doAction(...) success, onModelChange function is called twice. (open, stale)
- [#504](https://github.com/caplin/FlexLayout/issues/504) Duplicate onModelChange listeners (closed, not planned, stale)
- [#318](https://github.com/caplin/FlexLayout/issues/318) How do I get the tabset ID after the move? (closed)
- [#355](https://github.com/caplin/FlexLayout/issues/355) Action FlexLayout_MaximizeToggle (onAction) dalayed execution (open)
- [#192](https://github.com/caplin/FlexLayout/issues/192) Adding 'visible' event listener doesn't trigger first time hidden tab becomes visible (open, stale)
- [#442](https://github.com/caplin/FlexLayout/issues/442) Incorrect Timing of Visibility Event in `Node._setVisible` Method (open)
- [#233](https://github.com/caplin/FlexLayout/issues/233) Add an afterResize tab node event (open, stale)
- [#284](https://github.com/caplin/FlexLayout/issues/284) Maximize event for node (open, stale)
- [#445](https://github.com/caplin/FlexLayout/issues/445) `node.setEventListener("save", fn)` getting repeatedly called in the demo (open, stale)
- [#22](https://github.com/caplin/FlexLayout/issues/22) Custom button on Tab (closed)
- [#237](https://github.com/caplin/FlexLayout/issues/237) Cannot call Model.doAction in render (closed, not planned, stale)

**Verdict: solved.** Middleware (`model.use`) runs around every command, the engine's and the
app's alike, and can veto, rewrite or observe before and after. `model.subscribe` receives exactly
one event per commit (one for a whole batch, none for a refused command), carrying the command, the
payload, the result and the `before` and `after` states; the engine adds no event of its own
([caplin/FlexLayout#513](https://github.com/caplin/FlexLayout/issues/513)). The engine subscribes once per model, and re-rendering `Dockable.Root` with
new props under StrictMode keeps the model's listeners at one set
([caplin/FlexLayout#504](https://github.com/caplin/FlexLayout/issues/504)).

## T4 Untyped `config`, TypeScript quality

`config` is `any`, every read is a cast, `getNodeById` returned a non-optional node, and the build
had import cycles.

- [#177](https://github.com/caplin/FlexLayout/issues/177) Config TypeScript Types (open, stale)
- [#31](https://github.com/caplin/FlexLayout/issues/31) Config attribute in tab (open, stale)
- [#92](https://github.com/caplin/FlexLayout/issues/92) pass args to addNode that are passed to the factory (open, stale)
- [#371](https://github.com/caplin/FlexLayout/issues/371) How can I access the config of each tabNode together from any node?? (closed)
- [#212](https://github.com/caplin/FlexLayout/issues/212) TypeScript issue with ILayoutState (open (open (fixed in 0.11.0), stale)
- [#377](https://github.com/caplin/FlexLayout/issues/377) Model.getNodeById return type should be Node \| undefined (closed)
- [#347](https://github.com/caplin/FlexLayout/issues/347) Fix Circular Dependencies with building with typescript? (open)
- [#409](https://github.com/caplin/FlexLayout/issues/409) Add getName method to Node class (open)

**Verdict: solved.** A type registry maps each component to its data type
(`createModel<{ tabs: { editor: EditorData } }>`); `tab.data` narrows on `tab.component`, and wrong
data for a component is a compile error. Every read that can miss returns `| undefined`
(`model.get("node-by", { id })`). The public declarations contain no `any` (a guard checks the
built `.d.ts`). The state model is plain data with no class cycles.

## T5 Attribute and global-attribute confusion, docs that drift

About 110 attributes, a global mirror for most of them (`tabSetEnableClose` next to `enableClose`),
aliases, and attributes that are documented but never read (`className`, `classNameTabStrip`,
`tabSetEnableTabStrip`, …). The docs are generated from attribute definitions that do not say
whether anything reads them.

- [#30](https://github.com/caplin/FlexLayout/issues/30) Both tabSetEnableClose and enableClose in tabset do not work (open, stale)
- [#191](https://github.com/caplin/FlexLayout/issues/191) Global Attributes for classNames not working? (open, stale)
- [#57](https://github.com/caplin/FlexLayout/issues/57) className attribute of TabNode does not work (closed)
- [#418](https://github.com/caplin/FlexLayout/issues/418) classNameTabStrip disappears after moving a tab/tabset (closed)
- [#263](https://github.com/caplin/FlexLayout/issues/263) TabSetMinWidth and tabSetMinHeight are invalid (closed)
- [#455](https://github.com/caplin/FlexLayout/issues/455) tabEnableDrag: false, tabSetEnableDrag: false does not work. (closed)
- [#395](https://github.com/caplin/FlexLayout/issues/395) Maximizing tabset through `updateNodeAttributes` doesn't work (closed)
- [#289](https://github.com/caplin/FlexLayout/issues/289) Enable remove tabset header name (open (open (fixed in 0.11.0), stale)
- [#13](https://github.com/caplin/FlexLayout/issues/13) Are onTabRender and onTabSetRender actually an option? (open, stale)

**Verdict: solved.** The model keeps the layout's data and its rules, and nothing cosmetic: class
names, titles and icons are the app's, in its typed `data` or in primitive props. Most fields are
rules the commands enforce (`draggable`, `droppable`, `closable`, `pinned`, …). Some are read
only by the engine, and the docs say so: the size limits (`minWidth`, `maxWidth`, `minHeight`,
`maxHeight`) by the split math, `defaults.layout.edgeDock`, `edgeDockMargin` and `edgeDockLength`
by the drag, a border's `mode` and `autoHide` by the rendering and the drag, and a window's `rect`
by the popout manager. A tab's `label` and `data` are stored for the app, which renders them; no
primitive reads them. One defaults rule replaces the global mirrors:
`node.x ?? defaults[kind].x ?? built-in`. The command reference is generated from the registry
and checked for drift.

## T6 Serialization and migration across versions

Saved layouts break across versions, `toJson` mixes runtime state with the app's data, and a
malformed layout fails somewhere deep in the model.

- [#82](https://github.com/caplin/FlexLayout/issues/82) Save layout (closed)
- [#211](https://github.com/caplin/FlexLayout/issues/211) questions about design (closed)
- [#282](https://github.com/caplin/FlexLayout/issues/282) dblclicking tabs generates model changes which prevents tab renaming in edge-cases (closed)
- [#271](https://github.com/caplin/FlexLayout/issues/271) not detecting double-clicks (closed)
- [#92](https://github.com/caplin/FlexLayout/issues/92) pass args to addNode that are passed to the factory (open, stale)
- [#477](https://github.com/caplin/FlexLayout/issues/477) Hidden tabs not working correctly (closed)

**Verdict: addressed.** JSON v1 carries `version: 1`, the hook for future migrations. `createModel`
and `layout.load` validate against the exported `layoutSchema` and report every error with a JSON
path. App data lives in `data`, apart from the layout's own fields. Migrating from FlexLayout's
JSON is not built.

## T7 Styling and CSS lock-in

Class names that cannot be changed, a Sass build, inline images blocked by CSP, a drag glass that
cannot be styled.

- [#32](https://github.com/caplin/FlexLayout/issues/32) Feature request: Custom class names (open (open (fixed in 0.11.0), stale)
- [#150](https://github.com/caplin/FlexLayout/issues/150) [Discuss] Will jss better than import a css? (closed)
- [#460](https://github.com/caplin/FlexLayout/issues/460) [sass] `@import` is deprecated by sass (closed)
- [#176](https://github.com/caplin/FlexLayout/issues/176) Problem with base 64 images in CSP directive (open, stale)
- [#104](https://github.com/caplin/FlexLayout/issues/104) Custom glass props on drag/drop (open, stale)
- [#229](https://github.com/caplin/FlexLayout/issues/229) Set opacity: 0 on _glass (closed, not planned, stale)
- [#239](https://github.com/caplin/FlexLayout/issues/239) highlighting a tabset (open, stale)
- [#339](https://github.com/caplin/FlexLayout/issues/339) How to conditional colour a tab button (closed)
- [#306](https://github.com/caplin/FlexLayout/issues/306) Question: custom dock drop indicator (open, stale)
- [#486](https://github.com/caplin/FlexLayout/issues/486) Feature request about tab and tabset (closed, not planned, stale)
- [#286](https://github.com/caplin/FlexLayout/issues/286) buttonFactory prop for customizing buttons. (closed)

**Verdict: by design.** Dockable ships no CSS, no icons and no class names; state is exposed as
`data-*` and ARIA, and every primitive takes `className`, `style` and `render`.

## T8 Popouts

Libraries that render into the global `document` break in a popout, React StrictMode closes the
window, the placeholder cannot be customised, and the window cannot be configured.

- [#161](https://github.com/caplin/FlexLayout/issues/161) Note: some libraries already support popout windows by allowing you to specify the document. (open, stale)
- [#166](https://github.com/caplin/FlexLayout/issues/166) Bug: Resize listeners get stripped when tab is popped out (closed)
- [#163](https://github.com/caplin/FlexLayout/issues/163) Bug with draggable library after open it in outer window (open, stale)
- [#117](https://github.com/caplin/FlexLayout/issues/117) React Leaflet Map is displayed in any other TAB popout (closed)
- [#146](https://github.com/caplin/FlexLayout/issues/146) New version has problem with canvas object which has a map object inside (open, stale)
- [#235](https://github.com/caplin/FlexLayout/issues/235) Trying to pop out a tab closes the created window instantly (closed, not planned, stale)
- [#322](https://github.com/caplin/FlexLayout/issues/322) Pop-outs not working in react 18 with React.StrictMode? (open, stale)
- [#186](https://github.com/caplin/FlexLayout/issues/186) Popouts do not work in Chrome (tested on version 88.0.4324.192) (closed)
- [#180](https://github.com/caplin/FlexLayout/issues/180) Popouts without a placeholder (open, stale)
- [#208](https://github.com/caplin/FlexLayout/issues/208) [Feature Request] Make pop-outs configurable (open, stale)
- [#283](https://github.com/caplin/FlexLayout/issues/283) RFC: New system for popout windows (closed, not planned, stale)
- [#236](https://github.com/caplin/FlexLayout/issues/236) Add a callback like onRenderFloatingWindow (closed, not planned, stale)
- [#261](https://github.com/caplin/FlexLayout/issues/261) [Question] Pop-out/floating tab throws "Cannot read property getBoundingClientRect of null" (open, stale)
- [#525](https://github.com/caplin/FlexLayout/issues/525) Popout title id causes close/reopen cascade (closed)
- [#512](https://github.com/caplin/FlexLayout/issues/512) Floating Tabs (Popouts) with shadcn Dialog/popover elements (open, stale)

**Verdict: addressed.** The popout manager mirrors styles (links, style tags, CSSOM rules, adopted
sheets), keeps one window under StrictMode ([caplin/FlexLayout#322](https://github.com/caplin/FlexLayout/issues/322)), docks the tabs back when the
window cannot open ([caplin/FlexLayout#235](https://github.com/caplin/FlexLayout/issues/235)), and renders no placeholder text. `Dockable.Root`
takes `openWindow`, so an app can open the window its own way, and `onPopoutOpen` hands it the
window and its document. Libraries that use the global `document` instead of the element's
`ownerDocument` cannot be fixed from the layout: the
[popouts guide](../site/docs/guides/popouts.mdx#what-works-across-windows-and-what-does-not) says
what such a library does in a popout and how to give it the content's document. A document hook for those libraries is not
built.

## T9 Floats

Floating windows inside the page.

- [#11](https://github.com/caplin/FlexLayout/issues/11) Feature request: Floating windows (open, stale)
- [#61](https://github.com/caplin/FlexLayout/issues/61) [Proof of Concept] Floating resizable windows and... realtime resizing? (open, stale)
- [#126](https://github.com/caplin/FlexLayout/issues/126) Can i have (tabHeader + tabBody) in the floating window ? (closed)
- [#296](https://github.com/caplin/FlexLayout/issues/296) Floating tab placeholder shows through maximised floating tab placeholder (closed)

**Verdict: not built.** A tab leaves the main layout only into a popout window.

## T10 SSR, ESM and bundling

`document is not defined` on the server, `crypto` missing on plain HTTP and in Next.js, ESM
packaging, a class ErrorBoundary that server components reject.

- [#50](https://github.com/caplin/FlexLayout/issues/50) "ReferenceError: document is not defined" in server-side rendering (open, stale)
- [#115](https://github.com/caplin/FlexLayout/issues/115) Remove module level reference to window, document, navigator (closed)
- [#379](https://github.com/caplin/FlexLayout/issues/379) crypto.randomUUID is not supported for http (closed)
- [#383](https://github.com/caplin/FlexLayout/issues/383) [Nextjs] crypto is not defined (closed)
- [#440](https://github.com/caplin/FlexLayout/issues/440) NextJS Server component not supported due to ErrorBoundary being a class component (open)
- [#501](https://github.com/caplin/FlexLayout/issues/501) Need to be able to disable the ErrorBoundary (closed, not planned, stale)
- [#464](https://github.com/caplin/FlexLayout/issues/464) simple build with vite is breaking because it is not compatible to ESM type (open, stale)
- [#367](https://github.com/caplin/FlexLayout/issues/367) Build Error: "Unexpected token export" when attempting to use actions (closed)
- [#81](https://github.com/caplin/FlexLayout/issues/81) _this.model._setChangeListener is not a function (open, stale)

**Verdict: solved.** The core is ESM, touches no global `document`, `window` or `crypto` (a guard
test enforces it), and the model loads and runs in Node ([caplin/FlexLayout#50](https://github.com/caplin/FlexLayout/issues/50)). Ids come from an
injectable generator whose default is deterministic, and a model works with no global `crypto`
([caplin/FlexLayout#383](https://github.com/caplin/FlexLayout/issues/383)). The primitives render on the server (a test renders a layout to a string
in Node, with no document), and they render no ErrorBoundary.

## T11 Sizing and constraints

Minimum and maximum sizes, realtime resize, a vertical root, a panel that takes the remaining space,
a border's maximum size.

- [#10](https://github.com/caplin/FlexLayout/issues/10) Feature request: Realtime resizing (open, stale)
- [#241](https://github.com/caplin/FlexLayout/issues/241) Realtime tab resizing as you drag gutters (closed)
- [#56](https://github.com/caplin/FlexLayout/issues/56) [Improvement] Ability to specify size for a tab (open, stale)
- [#77](https://github.com/caplin/FlexLayout/issues/77) Is there any way I can set a min width to Tab (open, stale)
- [#351](https://github.com/caplin/FlexLayout/issues/351) Is it possible to specify someone panel to take the "remaining space"? (open)
- [#470](https://github.com/caplin/FlexLayout/issues/470) Splitter resize help (open, stale)
- [#219](https://github.com/caplin/FlexLayout/issues/219) [Feature Request]: borderMaxSize option (open, stale)
- [#162](https://github.com/caplin/FlexLayout/issues/162) Dynamic border tab size value based on screen size (open, stale)
- [#172](https://github.com/caplin/FlexLayout/issues/172) Add ability to make root row vertical (open, stale)
- [#406](https://github.com/caplin/FlexLayout/issues/406) resizeObserver observe high frequency resize action inside Tabset (open)

**Verdict: addressed where the model owns it.** Min and max sizes are model fields enforced by the
split math; realtime resize is an engine option (`realtimeResize`); the root orientation and the
border `minSize`/`maxSize` are model fields. "Fill the remaining space" and fixed pixel sizes are
not built.

## T12 Drag and drop interop and robustness

FlexLayout claims every drag that enters it (breaking other drag libraries and nested layouts),
leaves state behind after a text or file drop, and loses the next drag after a cancelled one.

- [#497](https://github.com/caplin/FlexLayout/issues/497) Dragging external element into nested FlexLayout (closed, not planned, stale)
- [#350](https://github.com/caplin/FlexLayout/issues/350) Drag and Drop between two lists is blocked by FlexLayout (open)
- [#72](https://github.com/caplin/FlexLayout/issues/72) Feature Request: handle drag/drop of tab (open, stale)
- [#203](https://github.com/caplin/FlexLayout/issues/203) Drag and drop between browser tabs (open, stale)
- [#280](https://github.com/caplin/FlexLayout/issues/280) Using drag and drop outside of the layout (or, adding custom drag regions / widgets outside of the borders) (closed, not planned, stale)
- [#47](https://github.com/caplin/FlexLayout/issues/47) addTabWithDragAndDrop does not work (open (open (fixed in 0.11.0), stale)
- [#48](https://github.com/caplin/FlexLayout/issues/48) addTabWithDragAndDrop - duplicate id (open (open (fixed in 0.11.0), stale)
- [#268](https://github.com/caplin/FlexLayout/issues/268) [Question] Is it possible to detect when Layout#addTabWithDragAndDropIndirect is cancelled? (closed)
- [#390](https://github.com/caplin/FlexLayout/issues/390) Drag n Drop leaving artifacts in layout (open)
- [#527](https://github.com/caplin/FlexLayout/issues/527) A drop of text or files inside a tab leaves the next tab drag without an overlay or drop outline (open)
- [#528](https://github.com/caplin/FlexLayout/issues/528) A tab dragged out of the overflow menu and let go outside the layout takes over the next drag (open)
- [#471](https://github.com/caplin/FlexLayout/issues/471) No Dock Area (open, stale)
- [#308](https://github.com/caplin/FlexLayout/issues/308) Not able to drag tabs while a tabset is maximized (closed)

**Verdict: addressed.** The drag and drop manager claims only drags that carry its own payload
type (`DRAG_TYPE`), so another library's drags pass through. `onExternalDrag` is never asked about
a native drag that started in the layout's own content, so a drag between two lists in a tab stays
the lists' ([caplin/FlexLayout#350](https://github.com/caplin/FlexLayout/issues/350)) and a layout nested in a tab keeps the drags meant for it
([caplin/FlexLayout#497](https://github.com/caplin/FlexLayout/issues/497)). Every `drop` and `dragend` in the document resets the layout's drag
state from the capture phase, so content that stops their propagation cannot leave it behind, and
every drag starts from a clean slate ([caplin/FlexLayout#527](https://github.com/caplin/FlexLayout/issues/527)). A drag whose source unmounted is ended
by the next foreign drag or the first pointer move with no button held
([caplin/FlexLayout#528](https://github.com/caplin/FlexLayout/issues/528)), and a drop leaves no outline behind ([caplin/FlexLayout#390](https://github.com/caplin/FlexLayout/issues/390)). A drop is
allowed exactly when the model allows its command (`model.can`), so a middleware is the drop
policy. Dragging a tab to another browser tab or window is not built.

## T13 Accessibility and keyboard

Accessible names, keyboard-only use, screen readers.

- [#83](https://github.com/caplin/FlexLayout/issues/83) Tab min button should have an aria-label (closed)
- [#118](https://github.com/caplin/FlexLayout/issues/118) Button In Factory Title & Accessibility Support (open, stale)
- [#298](https://github.com/caplin/FlexLayout/issues/298) Accessibility Support - Keyboard Only and Screen Readers (closed)
- [#511](https://github.com/caplin/FlexLayout/issues/511) [Enhancement][a11y] Accessibility support and roadmap (closed, not planned, stale)
- [#481](https://github.com/caplin/FlexLayout/issues/481) Numpad Enter doesn't confirm rename (closed)
- [#529](https://github.com/caplin/FlexLayout/issues/529) matchesKey throws on a keydown event without a key (open)

**Verdict: solved.** The primitives follow the APG tabs and separator patterns, render no text of
their own, and take accessible names from the app. `matchesKey` ignores a keydown that carries no
key (autofill and scripts send them), where FlexLayout throws
([caplin/FlexLayout#529](https://github.com/caplin/FlexLayout/issues/529)).

## T14 RTL, i18n, hard-coded text

Right-to-left layouts and translated strings.

- [#225](https://github.com/caplin/FlexLayout/issues/225) rtl direction cause wrong position of items in tabbar (open, stale)
- [#55](https://github.com/caplin/FlexLayout/issues/55) Configure texts when move tab or tabset (closed, stale)
- [#84](https://github.com/caplin/FlexLayout/issues/84) i18nMapper (open, stale)
- [#286](https://github.com/caplin/FlexLayout/issues/286) buttonFactory prop for customizing buttons. (closed)
- [#52](https://github.com/caplin/FlexLayout/issues/52) Programmatic Tab Rename (open, stale)

**Verdict: i18n by design; RTL solved.** There is no text to translate: the packages ship no
labels and no label keys, and every accessible name comes from the app. A layout renders right to
left (the rows mirror, the tab strips run from the right), and since
[#118](https://github.com/fragiola/dockable/issues/118) it responds that way too: the engine reads
its root's direction (`engine.get("direction")`), so splitter drags and keys, side, edge and strip
drops (#225's tab bar positions included) and overlay borders follow the screen, and a runtime
`dir` flip repositions the panels (gaps 4 and 5 of `limitations.mdx`, solved). The RTL fixture's
spec (`apps/playground/e2e/rtl.spec.ts`) drives each of them.

## T15 Tab strip, overflow, borders, menus

Overflowing borders, wrapping tab strips, render loops with sticky buttons, context menus, several
open border tabs, auto-hide borders.

- [#40](https://github.com/caplin/FlexLayout/issues/40) Bug: when there are many panels docked on side bar they get overflowed (open, stale)
- [#195](https://github.com/caplin/FlexLayout/issues/195) Tab buttons rendering outside tab bar when overflow (closed)
- [#302](https://github.com/caplin/FlexLayout/issues/302) Tabs wrapping (open, stale)
- [#228](https://github.com/caplin/FlexLayout/issues/228) Re-order tabs in overflow menu (closed, not planned, stale)
- [#517](https://github.com/caplin/FlexLayout/issues/517) "Maximum update depth exceeded" if sticky buttons in TabSet is wider than 10px (closed)
- [#498](https://github.com/caplin/FlexLayout/issues/498) Maximum update depth exceeded (closed, not planned, stale)
- [#210](https://github.com/caplin/FlexLayout/issues/210) Open multiple border tabs (open, stale)
- [#160](https://github.com/caplin/FlexLayout/issues/160) Show or hide border dock on tab selection (open, stale)
- [#494](https://github.com/caplin/FlexLayout/issues/494) How to render a border tabset at the edge? (closed, not planned, stale)
- [#518](https://github.com/caplin/FlexLayout/issues/518) Border with auto hide is still visible (open, stale)
- [#439](https://github.com/caplin/FlexLayout/issues/439) multiple quick clicks on left border button not working properly (open)
- [#232](https://github.com/caplin/FlexLayout/issues/232) No flexlayout__tabset-selected equivalent for borders (closed, not planned, stale)
- [#275](https://github.com/caplin/FlexLayout/issues/275) request: onContextMenu prop for tabSet and tab (open (open (fixed in 0.11.0), stale)
- [#273](https://github.com/caplin/FlexLayout/issues/273) TabSet context menu, how? (closed)
- [#33](https://github.com/caplin/FlexLayout/issues/33) Changing Tabs or rendering all invisible tabs on startup. (closed)
- [#111](https://github.com/caplin/FlexLayout/issues/111) How can i render a non selected tabs in a tabset (I want to render all of tabs in a tabset) (open, stale)
- [#319](https://github.com/caplin/FlexLayout/issues/319) Keep all tabs mounted (open)

**Verdict: menus by design; overflow loops solved; several open tabs per border not built.** Menus
are the app's: the packages provide the commands and their `model.can` answers, never a rendered
menu. Tab overflow is computed by a pure function from measured sizes, and the trigger's space is
measured rather than a fixed hysteresis, so it settles ([caplin/FlexLayout#517](https://github.com/caplin/FlexLayout/issues/517),
[caplin/FlexLayout#498](https://github.com/caplin/FlexLayout/issues/498)). A border shows one selected tab at a time.

## AI and automation

No issue asks for AI integration. The indirect demand comes from users who drive the layout from a
store or from outside the React tree:

- [#456](https://github.com/caplin/FlexLayout/issues/456) Will onModelChange cause all the components rendered inside the factory to be re-rendered after modifying the model? (open, stale)
- [#17](https://github.com/caplin/FlexLayout/issues/17) Redux? (closed)
- [#116](https://github.com/caplin/FlexLayout/issues/116) How To use redux ? (closed)
- [#332](https://github.com/caplin/FlexLayout/issues/332) Can accept latest data into function component when useSelector updated? (closed)
- [#38](https://github.com/caplin/FlexLayout/issues/38) Mobile size friendly (open, stale)

[caplin/FlexLayout#456](https://github.com/caplin/FlexLayout/issues/456) asks to "make the model a dispatcher for actions". The command bus goes
further: every command has a name, a description and a JSON Schema (`model.get("commands")`), and
`model.dispatch({ command, payload, transient? }, { meta })` validates untrusted JSON before
anything changes. That is what an assistant, a socket or a command palette needs to drive the
layout.

## Not built yet

The verdicts above that say "not built", with the issues behind them. `limitations.mdx` lists the
same features from the docs' side.

- **Floats** (T9): floating windows inside the page. [caplin/FlexLayout#11](https://github.com/caplin/FlexLayout/issues/11), [caplin/FlexLayout#61](https://github.com/caplin/FlexLayout/issues/61), [caplin/FlexLayout#126](https://github.com/caplin/FlexLayout/issues/126),
  [caplin/FlexLayout#296](https://github.com/caplin/FlexLayout/issues/296).
- **Tab groups**: pills grouping tabs in a strip; a tabset or border holds tabs only.
- **Fill and fixed sizes** (T11): a tabset that fills the remaining space, fixed pixel sizes, sizes
  that follow the screen. [caplin/FlexLayout#351](https://github.com/caplin/FlexLayout/issues/351), [caplin/FlexLayout#56](https://github.com/caplin/FlexLayout/issues/56), [caplin/FlexLayout#162](https://github.com/caplin/FlexLayout/issues/162),
  [caplin/FlexLayout#470](https://github.com/caplin/FlexLayout/issues/470).
- **Cross-window tab drag** (T12): dragging a tab to another browser tab or window.
  [caplin/FlexLayout#203](https://github.com/caplin/FlexLayout/issues/203).
- **Several open tabs per border** (T15): a border shows one selected tab at a time.
  [caplin/FlexLayout#210](https://github.com/caplin/FlexLayout/issues/210).
- **A popout document hook** (T8) for libraries that portal into the global `document`.
  [caplin/FlexLayout#161](https://github.com/caplin/FlexLayout/issues/161), [caplin/FlexLayout#512](https://github.com/caplin/FlexLayout/issues/512).

## Regression matrix

One test per concrete FlexLayout bug, named after it, so `git grep "caplin/FlexLayout#<n>"` finds
it. "Fixed" means Dockable had the bug and the fix landed with its test; "pass" means Dockable did
not have it and the test keeps it that way; "by design" pins the intended behaviour. No test is
`fixme`. Paths are relative to the repository root; `content-drag`, `external` and `overflow` are
playground fixtures driven by Playwright.

| issue | FlexLayout failure | test (file: name) | status |
|---|---|---|---|
| [caplin/FlexLayout#529](https://github.com/caplin/FlexLayout/issues/529) | `matchesKey` throws on a `keydown` with no `key` (autofill, scripts) | `packages/core/tests/keyboard/KeyMap.test.ts`: never matches an event with no key, and does not throw<br>`packages/react/tests/primitives.test.tsx`: ignores a keydown that carries no key | fixed |
| [caplin/FlexLayout#527](https://github.com/caplin/FlexLayout/issues/527) | after a text or file drop inside a tab, the next tab drag shows no overlay, outline or edges | `packages/core/tests/dnd/DragDropManager.test.ts`: resets after a drop whose propagation the content stopped; starts each drag from a clean slate, even after a drop the document never saw; ends the drag on a dragend whose propagation the source stopped<br>`apps/playground/e2e/content-drag.spec.ts`: a tab drag after a drop the content stopped shows its drop outline | fixed (Dockable had it when content stopped the drop's propagation) |
| [caplin/FlexLayout#528](https://github.com/caplin/FlexLayout/issues/528) | a tab dragged out of an overflow menu that unmounts, let go outside, takes over the next drag | `packages/core/tests/dnd/DragDropManager.test.ts`: does not let a drag whose source unmounted take over the next one<br>`apps/playground/e2e/content-drag.spec.ts`: a tab dragged from a menu that closes, let go outside the layout, does not take over the next drag | pass |
| [caplin/FlexLayout#390](https://github.com/caplin/FlexLayout/issues/390) | a widget dropped in from outside leaves the drop highlight on screen | `apps/playground/e2e/external.spec.ts`: leaves no drop outline behind after a drop from outside the layout | pass |
| [caplin/FlexLayout#350](https://github.com/caplin/FlexLayout/issues/350) | native drag and drop between two lists inside a tab is blocked | `packages/core/tests/dnd/DragDropManager.test.ts`: leaves a native drag between two lists of a tab to the lists, even with a handler that accepts everything<br>`apps/playground/e2e/content-drag.spec.ts`: a native drag between two lists of a tab moves the item and nothing else (with and without an onExternalDrag that accepts everything) | fixed (pass without `onExternalDrag`; with one that accepts everything, the drop also added a tab) |
| [caplin/FlexLayout#497](https://github.com/caplin/FlexLayout/issues/497) | nested layouts: the parent takes drags meant for the child | `packages/core/tests/dnd/DragDropManager.test.ts`: leaves a drag inside a nested layout to it: the outer layout neither asks nor claims it<br>`apps/playground/e2e/content-drag.spec.ts`: a layout nested in a tab keeps the drags meant for it | fixed (the same `onExternalDrag` origin rule) |
| [caplin/FlexLayout#513](https://github.com/caplin/FlexLayout/issues/513) | `onModelChange` fires twice per action | `packages/core/tests/state/bus.test.ts`: emits exactly one event per run, dispatch or batch<br>`packages/core/tests/engine/LayoutEngine.test.ts`: adds no event of its own: one command, one model event | pass |
| [caplin/FlexLayout#504](https://github.com/caplin/FlexLayout/issues/504) | listeners registered twice | `packages/react/tests/primitives.test.tsx`: keeps the model's listeners at one set, whatever props change | pass |
| [caplin/FlexLayout#498](https://github.com/caplin/FlexLayout/issues/498) | "Maximum update depth exceeded" switching tabs | `packages/react/tests/overflow.test.tsx`: switches tabs at the overflow boundary under StrictMode without an update loop<br>`apps/playground/e2e/overflow.spec.ts`: switching tabs at the overflow boundary settles, with no update loop | pass |
| [caplin/FlexLayout#517](https://github.com/caplin/FlexLayout/issues/517) | render loop when the overflow buttons are wider than a hard-coded hysteresis | `packages/core/tests/engine/overflow.test.ts`: settles in a few passes, at every width, with a trigger whose width grows with the hidden count<br>`apps/playground/e2e/overflow.spec.ts`: switching tabs at the overflow boundary settles, with no update loop | pass |
| [caplin/FlexLayout#322](https://github.com/caplin/FlexLayout/issues/322) | a popout opens and closes at once under StrictMode | `packages/core/tests/popout/PopoutManager.test.ts`: keeps one window through a StrictMode-style detach and reattach<br>`packages/react/tests/popout.test.tsx`: opens exactly one window under StrictMode<br>`apps/playground/e2e/popout.spec.ts`: StrictMode opens exactly one window | pass |
| [caplin/FlexLayout#235](https://github.com/caplin/FlexLayout/issues/235) | a popout closes at once (StrictMode, or a blocked popup) | `packages/core/tests/popout/PopoutManager.test.ts`: docks the tabs back when the window cannot open: a blocked popup | pass |
| [caplin/FlexLayout#50](https://github.com/caplin/FlexLayout/issues/50) | SSR: `document is not defined` | `packages/core/tests/guard.test.ts`: never touches global document, window or frame scheduling: it loads in Node<br>`packages/react/tests/ssr.test.tsx`: renders a layout to a string without a document | pass |
| [caplin/FlexLayout#383](https://github.com/caplin/FlexLayout/issues/383) | `crypto is not defined` (Next.js, plain HTTP) | `packages/core/tests/guard.test.ts`: never reaches for the global crypto (ids come from an injectable generator)<br>`packages/core/tests/state/load.test.ts`: creates and changes a model with no global crypto, as on plain HTTP | pass |
| [caplin/FlexLayout#291](https://github.com/caplin/FlexLayout/issues/291) | adding a tab to an empty tabset from the JSON fails: loading removed the tabset | `packages/core/tests/state/tidy.test.ts`: keeps the JSON's empty tabset, with its id, instead of making a new one; keeps only the first of several empty tabsets of the main layout; still removes the empty tabsets beside a tabset with tabs | fixed |
| [caplin/FlexLayout#51](https://github.com/caplin/FlexLayout/issues/51) | adding to the active tabset does nothing once it closed | `packages/core/tests/state/queries.test.ts`: default-tabset still answers once the active tabset is gone, so add-to-active lands | pass |
| [caplin/FlexLayout#394](https://github.com/caplin/FlexLayout/issues/394) | a layout with no tabset gets one anyway | `packages/core/tests/state/tidy.test.ts`: gives a main layout with no tabset a new one, which becomes active | by design |
| [caplin/FlexLayout#93](https://github.com/caplin/FlexLayout/issues/93) | moving every tab into a border leaves an empty main area | `packages/core/tests/state/commands.test.ts`: moving every tab into a border empties the main layout, as designed; a middleware can veto it | by design (the recipe is in `site/docs/guides/restricting-drops.mdx`) |
