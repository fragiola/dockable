# FlexLayout issues: what developers report, and what Dockable does about it

This report surveys the issue tracker of [caplin/FlexLayout](https://github.com/caplin/FlexLayout),
the library Dockable was ported from, and records what Dockable does about each recurring problem.
It is an input to the Engine v2 Epic (#43, design record in
[`engine-v2-design.md`](./engine-v2-design.md)) and to the follow-up support Epic.

The survey was taken on 2026-09-30 and checked against the source of `flexlayout-react` 0.11.0
(`../FlexLayout`, read-only). Issue states are as fetched that day.

## Stats

- The tracker holds **288 issues**: 141 open and 147 closed. Of the closed ones, 133 were closed as
  completed and 14 as "not planned" by the stale bot.
- **139 issues carry the `stale` label** (122 open, 17 closed). "Stale" means nobody answered, not
  that the problem went away.
- "Open" overstates what is unresolved. These issues are fixed in the 0.11.0 source but were never
  closed: [#32](https://github.com/caplin/FlexLayout/issues/32), [#47](https://github.com/caplin/FlexLayout/issues/47), [#48](https://github.com/caplin/FlexLayout/issues/48), [#99](https://github.com/caplin/FlexLayout/issues/99), [#212](https://github.com/caplin/FlexLayout/issues/212), [#275](https://github.com/caplin/FlexLayout/issues/275), [#289](https://github.com/caplin/FlexLayout/issues/289), [#310](https://github.com/caplin/FlexLayout/issues/310).
- This report cites 153 issues. 94 of them are open and 59 closed (9 of those as not planned); 90
  carry `stale`.

## Verdicts

Each theme gets one verdict for Dockable:

- **solved by this Epic**: the Engine v2 design removes the cause.
- **addressed in this Epic**: the Epic takes a concrete step, and what is left is named.
- **follow-up support Epic**: a feature that needs the new engine first; see the last section.
- **out of scope for a headless lib**: Dockable ships no CSS, text or rendered menus, so the
  problem cannot arise, or belongs to the app.

| theme | issues | verdict |
|---|---|---|
| T1 remount, state loss and re-renders on model change | 11 | solved: no view state in the model, and `layout.load` reconciles by id |
| T2 programmatic-control gaps and inconsistent actions | 18 | solved: an orthogonal command catalogue, idempotent setters, batch, no silent auto-structure |
| T3 event timing, duplicates, before and after | 11 | solved: middleware before and after, one `subscribe`, events that carry the result |
| T4 untyped `config`, TypeScript quality | 8 | solved: typed `data` registry, strict nullability, no import cycles |
| T5 attribute and global-attribute confusion, docs that drift | 9 | solved: trimmed model, one defaults rule, generated command docs |
| T6 serialization and migration across versions | 6 | addressed: `version`, schema validation, `data` separate from runtime state |
| T7 styling and CSS lock-in | 11 | solved by design (headless) |
| T8 popouts | 15 | addressed: an injectable window opener; libraries that use the global document are documented, not fixed |
| T9 floats | 4 | follow-up support Epic |
| T10 SSR, ESM and bundling | 9 | solved: Node-loadable core, no `crypto` needed, no forced ErrorBoundary |
| T11 sizing and constraints | 10 | addressed where the model owns it (min/max, root orientation); "fill" and fixed sizes go to the follow-up |
| T12 drag and drop interop and robustness | 13 | addressed: only claim our own drags, reset on every drop and dragend, drop policy as middleware; cross-window-tab drag goes to the follow-up |
| T13 accessibility and keyboard | 6 | solved by design, plus a defensive `matchesKey` |
| T14 RTL, i18n, hard-coded text | 5 | i18n solved by design; RTL goes to the follow-up |
| T15 tab strip, overflow, borders, menus | 17 | menus solved by design; overflow loops addressed; multi-open borders go to the follow-up |

## T1 Remount, state loss and re-renders on model change

The most discussed theme. FlexLayout keeps view state inside the model's nodes: `TabNode` holds the
moveable element, the scroll position and a frame handle, and `Model.fromJson(json, previous)` has
to copy that state across ("adopt") so replacing the model does not remount the content. Any app
that rebuilds the model (Redux, undo, sync) loses content or re-renders the whole layout.

- [#456](https://github.com/caplin/FlexLayout/issues/456) Will onModelChange cause all the components rendered inside the factory to be re-rendered after modifying the model? (open, stale)
- [#496](https://github.com/caplin/FlexLayout/issues/496) Too much rerender, whole FlexLayout rerender even when I perform some operation inside any tab (open, stale)
- [#524](https://github.com/caplin/FlexLayout/issues/524) Model updates trigger unnecessary re-renders for tab components (closed)
- [#181](https://github.com/caplin/FlexLayout/issues/181) Rerender after changing tabs (open, stale)
- [#482](https://github.com/caplin/FlexLayout/issues/482) Mount/Unmount Problem when conducting Action.MOVE_NODE (closed)
- [#520](https://github.com/caplin/FlexLayout/issues/520) `Actions.addNode` causing duplicate lifecycle flow in web components (closed, stale)
- [#149](https://github.com/caplin/FlexLayout/issues/149) avoid re-render of existing tabset? (closed)
- [#121](https://github.com/caplin/FlexLayout/issues/121) Content of tabs not preserved when showing/hiding SubLayout (closed)
- [#285](https://github.com/caplin/FlexLayout/issues/285) React context is not available inside onRenderTab when dragging the tab after updating to 0.6.0 (closed)
- [#498](https://github.com/caplin/FlexLayout/issues/498) Maximum update depth exceeded (open, stale)
- [#517](https://github.com/caplin/FlexLayout/issues/517) "Maximum update depth exceeded" if sticky buttons in TabSet is wider than 10px (closed)

**Verdict: solved by this Epic.** The model holds no DOM or view state. The engine keeps moveable
elements, rects, scroll and "rendered" keyed by node id, so a new state with the same ids finds the
same elements. `layout.load` replaces the state and reconciles by id, and the engine re-renders
only what changed. React's `useModelState(selector)` re-renders a component only when its
selection changes.

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
- [#310](https://github.com/caplin/FlexLayout/issues/310) Is there a way to drag tabs/tabsets without having the tabSetStrip enabled? (open (fixed in 0.11.0), stale)
- [#394](https://github.com/caplin/FlexLayout/issues/394) Layout with no tabset creates a random tabset by default (open)
- [#93](https://github.com/caplin/FlexLayout/issues/93) Avoid empty canvas (open, stale)

**Verdict: solved by this Epic.** One command catalogue, `<kind>.<verb>`, with payload keys that
always name the kind (`tab`, `tabset`, `to`, `border`, `row`, `window`). Setters are idempotent
(`tabset.maximize` takes a `value`), `tab.select` works in borders, `tab.add` and `tab.move` accept
a tabset, a row, a border or a layout as `to`, `row.resize` sets weights, and `batch` runs several
commands atomically. A command that cannot apply returns a structured error instead of doing
nothing.

## T3 Event timing, duplicates, before and after

`onModelChange` fires twice, fires late, fires before the view settled, or cannot tell the app what
the action returned (the id of a new tabset). There is no "before" hook apart from `onAction`, which
a direct `model.doAction` bypasses.

- [#513](https://github.com/caplin/FlexLayout/issues/513) When calling model.doAction(...) success, onModelChange function is called twice. (open, stale)
- [#504](https://github.com/caplin/FlexLayout/issues/504) Duplicate onModelChange listeners (open, stale)
- [#318](https://github.com/caplin/FlexLayout/issues/318) How do I get the tabset ID after the move? (closed)
- [#355](https://github.com/caplin/FlexLayout/issues/355) Action FlexLayout_MaximizeToggle (onAction) dalayed execution (open)
- [#192](https://github.com/caplin/FlexLayout/issues/192) Adding 'visible' event listener doesn't trigger first time hidden tab becomes visible (open, stale)
- [#442](https://github.com/caplin/FlexLayout/issues/442) Incorrect Timing of Visibility Event in `Node._setVisible` Method (open)
- [#233](https://github.com/caplin/FlexLayout/issues/233) Add an afterResize tab node event (open, stale)
- [#284](https://github.com/caplin/FlexLayout/issues/284) Maximize event for node (open, stale)
- [#445](https://github.com/caplin/FlexLayout/issues/445) `node.setEventListener("save", fn)` getting repeatedly called in the demo (open, stale)
- [#22](https://github.com/caplin/FlexLayout/issues/22) Custom button on Tab (closed)
- [#237](https://github.com/caplin/FlexLayout/issues/237) Cannot call Model.doAction in render (closed, not planned, stale)

**Verdict: solved by this Epic.** Middleware (`model.use`) runs around every command, the engine's
and the app's alike, and can veto, rewrite or observe before and after. `model.subscribe` receives
exactly one event per commit (one for a whole batch), carrying the command, the payload, the result
and the `before` and `after` states.

## T4 Untyped `config`, TypeScript quality

`config` is `any`, every read is a cast, `getNodeById` returned a non-optional node, and the build
had import cycles.

- [#177](https://github.com/caplin/FlexLayout/issues/177) Config TypeScript Types (open, stale)
- [#31](https://github.com/caplin/FlexLayout/issues/31) Config attribute in tab (open, stale)
- [#92](https://github.com/caplin/FlexLayout/issues/92) pass args to addNode that are passed to the factory (open, stale)
- [#371](https://github.com/caplin/FlexLayout/issues/371) How can I access the config of each tabNode together from any node?? (closed)
- [#212](https://github.com/caplin/FlexLayout/issues/212) TypeScript issue with ILayoutState (open (fixed in 0.11.0), stale)
- [#377](https://github.com/caplin/FlexLayout/issues/377) Model.getNodeById return type should be Node \| undefined (closed)
- [#347](https://github.com/caplin/FlexLayout/issues/347) Fix Circular Dependencies with building with typescript? (open)
- [#409](https://github.com/caplin/FlexLayout/issues/409) Add getName method to Node class (open)

**Verdict: solved by this Epic.** A type registry maps each component to its data type
(`createModel<{ tabs: { editor: EditorData } }>`); `tab.data` narrows on `tab.component`, and wrong
data for a component is a compile error. Every query that can miss returns `| undefined`. The public
declarations contain no `any` (a guard checks the built `.d.ts`). The state model is plain data with
no class cycles.

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
- [#289](https://github.com/caplin/FlexLayout/issues/289) Enable remove tabset header name (open (fixed in 0.11.0), stale)
- [#13](https://github.com/caplin/FlexLayout/issues/13) Are onTabRender and onTabSetRender actually an option? (open, stale)

**Verdict: solved by this Epic.** The model keeps only what it enforces; everything cosmetic moves to
the app's typed `data` or to primitive props. One defaults rule replaces the global mirrors:
`node.x ?? defaults[kind].x ?? built-in`. The command reference is generated from the registry and
checked for drift.

## T6 Serialization and migration across versions

Saved layouts break across versions, `toJson` mixes runtime state with the app's data, and a
malformed layout fails somewhere deep in the model.

- [#82](https://github.com/caplin/FlexLayout/issues/82) Save layout (closed)
- [#211](https://github.com/caplin/FlexLayout/issues/211) questions about design (closed)
- [#282](https://github.com/caplin/FlexLayout/issues/282) dblclicking tabs generates model changes which prevents tab renaming in edge-cases (closed)
- [#271](https://github.com/caplin/FlexLayout/issues/271) not detecting double-clicks (closed)
- [#92](https://github.com/caplin/FlexLayout/issues/92) pass args to addNode that are passed to the factory (open, stale)
- [#477](https://github.com/caplin/FlexLayout/issues/477) Hidden tabs not working correctly (closed)

**Verdict: addressed in this Epic.** JSON v1 carries `version: 1`, the hook for future migrations.
`createModel` and `layout.load` validate against the exported `layoutSchema` and report every error
with a JSON path. App data lives in `data`, apart from the layout's own fields. Migrating from
FlexLayout's JSON is out of scope.

## T7 Styling and CSS lock-in

Class names that cannot be changed, a Sass build, inline images blocked by CSP, a drag glass that
cannot be styled.

- [#32](https://github.com/caplin/FlexLayout/issues/32) Feature request: Custom class names (open (fixed in 0.11.0), stale)
- [#150](https://github.com/caplin/FlexLayout/issues/150) [Discuss] Will jss better than import a css? (closed)
- [#460](https://github.com/caplin/FlexLayout/issues/460) [sass] `@import` is deprecated by sass (closed)
- [#176](https://github.com/caplin/FlexLayout/issues/176) Problem with base 64 images in CSP directive (open, stale)
- [#104](https://github.com/caplin/FlexLayout/issues/104) Custom glass props on drag/drop (open, stale)
- [#229](https://github.com/caplin/FlexLayout/issues/229) Set opacity: 0 on _glass (closed, not planned, stale)
- [#239](https://github.com/caplin/FlexLayout/issues/239) highlighting a tabset (open, stale)
- [#339](https://github.com/caplin/FlexLayout/issues/339) How to conditional colour a tab button (closed)
- [#306](https://github.com/caplin/FlexLayout/issues/306) Question: custom dock drop indicator (open, stale)
- [#486](https://github.com/caplin/FlexLayout/issues/486) Feature request about tab and tabset (open, stale)
- [#286](https://github.com/caplin/FlexLayout/issues/286) buttonFactory prop for customizing buttons. (closed)

**Verdict: solved by design.** Dockable ships no CSS, no icons and no class names; state is exposed
as `data-*` and ARIA, and every primitive takes `className`, `style` and `render`.

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

**Verdict: addressed in this Epic.** The popout manager already mirrors styles (links, style tags,
CSSOM rules, adopted sheets), keeps one window under StrictMode, and renders no placeholder text.
This Epic makes the window opener injectable (`openWindow`), so an app can open the window its own
way. Libraries that use the global `document` instead of the element's `ownerDocument` cannot be
fixed from the layout; the docs say so.

## T9 Floats

Floating windows inside the page.

- [#11](https://github.com/caplin/FlexLayout/issues/11) Feature request: Floating windows (open, stale)
- [#61](https://github.com/caplin/FlexLayout/issues/61) [Proof of Concept] Floating resizable windows and... realtime resizing? (open, stale)
- [#126](https://github.com/caplin/FlexLayout/issues/126) Can i have (tabHeader + tabBody) in the floating window ? (closed)
- [#296](https://github.com/caplin/FlexLayout/issues/296) Floating tab placeholder shows through maximised floating tab placeholder (closed)

**Verdict: follow-up support Epic.** Floats are removed from the model in this Epic and come back
designed on the command bus.

## T10 SSR, ESM and bundling

`document is not defined` on the server, `crypto` missing on plain HTTP and in Next.js, ESM
packaging, a class ErrorBoundary that server components reject.

- [#50](https://github.com/caplin/FlexLayout/issues/50) "ReferenceError: document is not defined" in server-side rendering (open, stale)
- [#115](https://github.com/caplin/FlexLayout/issues/115) Remove module level reference to window, document, navigator (closed)
- [#379](https://github.com/caplin/FlexLayout/issues/379) crypto.randomUUID is not supported for http (closed)
- [#383](https://github.com/caplin/FlexLayout/issues/383) [Nextjs] crypto is not defined (closed)
- [#440](https://github.com/caplin/FlexLayout/issues/440) NextJS Server component not supported due to ErrorBoundary being a class component (open)
- [#501](https://github.com/caplin/FlexLayout/issues/501) Need to be able to disable the ErrorBoundary (open, stale)
- [#464](https://github.com/caplin/FlexLayout/issues/464) simple build with vite is breaking because it is not compatible to ESM type (open, stale)
- [#367](https://github.com/caplin/FlexLayout/issues/367) Build Error: "Unexpected token export" when attempting to use actions (closed)
- [#81](https://github.com/caplin/FlexLayout/issues/81) _this.model._setChangeListener is not a function (open, stale)

**Verdict: solved by this Epic.** The core is ESM, touches no global `document`, `window` or
`crypto` (a guard test enforces it), and the model loads and runs in Node. Ids come from an
injectable generator whose default is deterministic. The primitives render no ErrorBoundary.

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

**Verdict: addressed in this Epic where the model owns it.** Min and max sizes are model fields
enforced by the split math; realtime resize is an engine option; the root orientation and the
border `minSize`/`maxSize` are model fields. "Fill the remaining space" and fixed pixel sizes go to
the follow-up support Epic.

## T12 Drag and drop interop and robustness

FlexLayout claims every drag that enters it (breaking other drag libraries and nested layouts),
leaves state behind after a text or file drop, and loses the next drag after a cancelled one.

- [#497](https://github.com/caplin/FlexLayout/issues/497) Dragging external element into nested FlexLayout (open, stale)
- [#350](https://github.com/caplin/FlexLayout/issues/350) Drag and Drop between two lists is blocked by FlexLayout (open)
- [#72](https://github.com/caplin/FlexLayout/issues/72) Feature Request: handle drag/drop of tab (open, stale)
- [#203](https://github.com/caplin/FlexLayout/issues/203) Drag and drop between browser tabs (open, stale)
- [#280](https://github.com/caplin/FlexLayout/issues/280) Using drag and drop outside of the layout (or, adding custom drag regions / widgets outside of the borders) (closed, not planned, stale)
- [#47](https://github.com/caplin/FlexLayout/issues/47) addTabWithDragAndDrop does not work (open (fixed in 0.11.0), stale)
- [#48](https://github.com/caplin/FlexLayout/issues/48) addTabWithDragAndDrop - duplicate id (open (fixed in 0.11.0), stale)
- [#268](https://github.com/caplin/FlexLayout/issues/268) [Question] Is it possible to detect when Layout#addTabWithDragAndDropIndirect is cancelled? (closed)
- [#390](https://github.com/caplin/FlexLayout/issues/390) Drag n Drop leaving artifacts in layout (open)
- [#527](https://github.com/caplin/FlexLayout/issues/527) A drop of text or files inside a tab leaves the next tab drag without an overlay or drop outline (open)
- [#528](https://github.com/caplin/FlexLayout/issues/528) A tab dragged out of the overflow menu and let go outside the layout takes over the next drag (open)
- [#471](https://github.com/caplin/FlexLayout/issues/471) No Dock Area (open, stale)
- [#308](https://github.com/caplin/FlexLayout/issues/308) Not able to drag tabs while a tabset is maximized (closed)

**Verdict: addressed in this Epic.** The drag and drop manager only claims drags that carry its own
payload type, resets its state on every `drop`, `dragend` and cancel, and asks the model
(`model.can`) whether a drop is allowed, so a middleware is the drop policy. Dragging a tab to
another browser tab or window stays out of scope for now (follow-up).

## T13 Accessibility and keyboard

Accessible names, keyboard-only use, screen readers.

- [#83](https://github.com/caplin/FlexLayout/issues/83) Tab min button should have an aria-label (closed)
- [#118](https://github.com/caplin/FlexLayout/issues/118) Button In Factory Title & Accessibility Support (open, stale)
- [#298](https://github.com/caplin/FlexLayout/issues/298) Accessibility Support - Keyboard Only and Screen Readers (closed)
- [#511](https://github.com/caplin/FlexLayout/issues/511) [Enhancement][a11y] Accessibility support and roadmap (open, stale)
- [#481](https://github.com/caplin/FlexLayout/issues/481) Numpad Enter doesn't confirm rename (closed)
- [#529](https://github.com/caplin/FlexLayout/issues/529) matchesKey throws on a keydown event without a key (open)

**Verdict: solved by design.** The primitives follow the APG tabs and separator patterns, render
no text of their own, and take accessible names from the app. `matchesKey` tolerates events without
a `key` ([caplin/FlexLayout#529](https://github.com/caplin/FlexLayout/issues/529)).

## T14 RTL, i18n, hard-coded text

Right-to-left layouts and translated strings.

- [#225](https://github.com/caplin/FlexLayout/issues/225) rtl direction cause wrong position of items in tabbar (open, stale)
- [#55](https://github.com/caplin/FlexLayout/issues/55) Configure texts when move tab or tabset (closed, stale)
- [#84](https://github.com/caplin/FlexLayout/issues/84) i18nMapper (open, stale)
- [#286](https://github.com/caplin/FlexLayout/issues/286) buttonFactory prop for customizing buttons. (closed)
- [#52](https://github.com/caplin/FlexLayout/issues/52) Programmatic Tab Rename (open, stale)

**Verdict: i18n solved by design; RTL goes to the follow-up.** There is no text to translate
(`DockableLabel` keys with no defaults). RTL tab strips and splitters are gaps 4 and 5 of
`limitations.mdx`.

## T15 Tab strip, overflow, borders, menus

Overflowing borders, wrapping tab strips, render loops with sticky buttons, context menus, several
open border tabs, auto-hide borders.

- [#40](https://github.com/caplin/FlexLayout/issues/40) Bug: when there are many panels docked on side bar they get overflowed (open, stale)
- [#195](https://github.com/caplin/FlexLayout/issues/195) Tab buttons rendering outside tab bar when overflow (closed)
- [#302](https://github.com/caplin/FlexLayout/issues/302) Tabs wrapping (open, stale)
- [#228](https://github.com/caplin/FlexLayout/issues/228) Re-order tabs in overflow menu (closed, not planned, stale)
- [#517](https://github.com/caplin/FlexLayout/issues/517) "Maximum update depth exceeded" if sticky buttons in TabSet is wider than 10px (closed)
- [#498](https://github.com/caplin/FlexLayout/issues/498) Maximum update depth exceeded (open, stale)
- [#210](https://github.com/caplin/FlexLayout/issues/210) Open multiple border tabs (open, stale)
- [#160](https://github.com/caplin/FlexLayout/issues/160) Show or hide border dock on tab selection (open, stale)
- [#494](https://github.com/caplin/FlexLayout/issues/494) How to render a border tabset at the edge? (open, stale)
- [#518](https://github.com/caplin/FlexLayout/issues/518) Border with auto hide is still visible (open, stale)
- [#439](https://github.com/caplin/FlexLayout/issues/439) multiple quick clicks on left border button not working properly (open)
- [#232](https://github.com/caplin/FlexLayout/issues/232) No flexlayout__tabset-selected equivalent for borders (closed, not planned, stale)
- [#275](https://github.com/caplin/FlexLayout/issues/275) request: onContextMenu prop for tabSet and tab (open (fixed in 0.11.0), stale)
- [#273](https://github.com/caplin/FlexLayout/issues/273) TabSet context menu, how? (closed)
- [#33](https://github.com/caplin/FlexLayout/issues/33) Changing Tabs or rendering all invisible tabs on startup. (closed)
- [#111](https://github.com/caplin/FlexLayout/issues/111) How can i render a non selected tabs in a tabset (I want to render all of tabs in a tabset) (open, stale)
- [#319](https://github.com/caplin/FlexLayout/issues/319) Keep all tabs mounted (open)

**Verdict: menus solved by design; overflow loops addressed; multi-open borders go to the
follow-up.** Menus are the app's (the package provides items and commands). Tab overflow is computed
by a pure function that cannot loop. Several open tabs per border is a feature for the follow-up.

## AI and automation

No issue asks for AI integration. The indirect demand comes from users who drive the layout from a
store or from outside the React tree:

- [#456](https://github.com/caplin/FlexLayout/issues/456) Will onModelChange cause all the components rendered inside the factory to be re-rendered after modifying the model? (open, stale)
- [#17](https://github.com/caplin/FlexLayout/issues/17) Redux? (closed)
- [#116](https://github.com/caplin/FlexLayout/issues/116) How To use redux ? (closed)
- [#332](https://github.com/caplin/FlexLayout/issues/332) Can accept latest data into function component when useSelector updated? (closed)
- [#38](https://github.com/caplin/FlexLayout/issues/38) Mobile size friendly (open, stale)

[caplin/FlexLayout#456](https://github.com/caplin/FlexLayout/issues/456) asks to "make the model a dispatcher for actions". The command bus goes
further: every command has a name, a description and a JSON Schema (`model.commands()`), and
`model.dispatch({ command, payload })` validates untrusted JSON. That is what an assistant, a socket
or a command palette needs to drive the layout, and it is new ground for this kind of library.

## Input for the follow-up support Epic

The follow-up verdicts, with the issues behind them. `limitations.mdx` lists the same gaps from the
docs' side.

- **Floats** (T9): floating windows inside the page, designed on the command bus (a `window` kind
  that is not a native window). [caplin/FlexLayout#11](https://github.com/caplin/FlexLayout/issues/11), [caplin/FlexLayout#61](https://github.com/caplin/FlexLayout/issues/61), [caplin/FlexLayout#126](https://github.com/caplin/FlexLayout/issues/126),
  [caplin/FlexLayout#296](https://github.com/caplin/FlexLayout/issues/296).
- **Tab groups**: removed from the model in this Epic; they come back with a design that renders
  in the primitives.
- **Sizing** (T11): a tabset that fills the remaining space, fixed pixel sizes, sizes that follow
  the screen. [caplin/FlexLayout#351](https://github.com/caplin/FlexLayout/issues/351), [caplin/FlexLayout#56](https://github.com/caplin/FlexLayout/issues/56), [caplin/FlexLayout#162](https://github.com/caplin/FlexLayout/issues/162),
  [caplin/FlexLayout#470](https://github.com/caplin/FlexLayout/issues/470).
- **Cross-window tab drag** (T12): dragging a tab to another browser tab or window.
  [caplin/FlexLayout#203](https://github.com/caplin/FlexLayout/issues/203).
- **RTL** (T14): right-to-left tab strips, splitters and edge docking. [caplin/FlexLayout#225](https://github.com/caplin/FlexLayout/issues/225).
- **Borders** (T15): several open tabs per border, and showing a border only while a tab is
  selected. [caplin/FlexLayout#210](https://github.com/caplin/FlexLayout/issues/210), [caplin/FlexLayout#160](https://github.com/caplin/FlexLayout/issues/160), [caplin/FlexLayout#494](https://github.com/caplin/FlexLayout/issues/494).
- **Popouts** (T8): a document-provider hook for libraries that portal into the global `document`.
  [caplin/FlexLayout#161](https://github.com/caplin/FlexLayout/issues/161), [caplin/FlexLayout#512](https://github.com/caplin/FlexLayout/issues/512).
