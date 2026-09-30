import type { Action, Model } from "@fragiola/dockable";
import { useEffect, useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";

// The Inspector: what the model does while you use the layout. Three views, all plain text:
//
//   Actions  every action the model applies (engine or direct `model.doAction` alike, through
//            `model.addChangeListener`), newest first
//   Model    `model.toJson()` after the last action
//   State    each `[data-layout-path]` element of the stage with its `data-*` and ARIA attributes,
//            re-read on every attribute change, so drag and drop state shows while it happens
//
// The App keys the panel by entry: switching starts from an empty log, and the listener and the
// observer of the previous entry are gone.

const MAX_ACTIONS = 200;

const VIEWS = ["actions", "model", "state"] as const;
type ViewName = (typeof VIEWS)[number];
const VIEW_TITLES: Record<ViewName, string> = {
    actions: "Actions",
    model: "Model",
    state: "State",
};

const PRESSED =
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

type LoggedAction = { n: number; time: string; type: string; data: string };

function stringify(value: unknown, indent?: number): string {
    try {
        return JSON.stringify(value, null, indent) ?? String(value);
    } catch (error) {
        return `(${String(error)})`;
    }
}

function time() {
    return new Date().toISOString().slice(11, 23);
}

/** Every action the model applies, newest first, and a counter that moves with each. */
function useActions(model: Model) {
    const [log, setLog] = useState<LoggedAction[]>([]);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        // a new model (the entry remounted: Retry, a Fast Refresh that resets state) starts a new
        // log; the old entries describe a model that is gone, and their keys would repeat
        setLog([]);
        let n = 0;
        const listener = {
            onAfterAction: (action: Action) => {
                n += 1;
                const entry = {
                    n,
                    time: time(),
                    type: action.type,
                    data: stringify(action.data),
                };
                setLog((current) => [entry, ...current].slice(0, MAX_ACTIONS));
                setVersion((v) => v + 1);
            },
        };
        model.addChangeListener(listener);
        return () => model.removeChangeListener(listener);
    }, [model]);
    return { log, version, clear: () => setLog([]) };
}

type ElementState = { path: string; attributes: [string, string][] };

function readState(stage: HTMLElement): ElementState[] {
    return Array.from(
        stage.querySelectorAll<HTMLElement>("[data-layout-path]"),
    ).map((element) => ({
        path: element.dataset.layoutPath ?? "",
        attributes: Array.from(element.attributes)
            .filter(
                (attribute) =>
                    (attribute.name.startsWith("data-") ||
                        attribute.name.startsWith("aria-") ||
                        attribute.name === "role") &&
                    attribute.name !== "data-layout-path",
            )
            .map((attribute) => [attribute.name, attribute.value]),
    }));
}

/** The stage's layout elements and their state attributes, re-read (once a frame) on change. */
function useLayoutState(stage: HTMLElement | null, active: boolean) {
    const [state, setState] = useState<ElementState[]>([]);
    useEffect(() => {
        if (!stage || !active) return;
        let frame = 0;
        const read = () => {
            frame = 0;
            setState(readState(stage));
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(read);
        };
        read();
        const observer = new MutationObserver(schedule);
        observer.observe(stage, {
            subtree: true,
            childList: true,
            attributes: true,
        });
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [stage, active]);
    return state;
}

export function InspectorPanel({
    model,
    stage,
}: {
    model: Model;
    stage: HTMLElement | null;
}) {
    const [view, setView] = useState<ViewName>("actions");
    const { log, version, clear } = useActions(model);
    const state = useLayoutState(stage, view === "state");
    // biome-ignore lint/correctness/useExhaustiveDependencies: `version` moves with each action, the model is mutable
    const json = useMemo(
        () => (view === "model" ? stringify(model.toJson(), 2) : ""),
        [model, view, version],
    );

    return (
        <aside
            aria-label="Inspector"
            className="flex w-[min(28rem,35%)] min-w-0 flex-col border-s border-palette-line"
        >
            <div className="flex items-center gap-1 border-b border-palette-line px-2 py-1">
                {VIEWS.map((name) => (
                    <Clickable.Button
                        key={name}
                        variant="ghost"
                        size="sm"
                        aria-pressed={name === view}
                        className={PRESSED}
                        onClick={() => setView(name)}
                    >
                        {VIEW_TITLES[name]}
                    </Clickable.Button>
                ))}
                {view === "actions" && (
                    <>
                        <span
                            data-testid="action-count"
                            className="ms-auto text-xs text-palette-accent/85"
                        >
                            {`${log.length} shown`}
                        </span>
                        <Clickable.Button
                            variant="outline"
                            size="sm"
                            disabled={log.length === 0}
                            onClick={clear}
                        >
                            Clear
                        </Clickable.Button>
                    </>
                )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto font-mono text-xs leading-relaxed">
                {view === "actions" &&
                    (log.length === 0 ? (
                        <p className="p-4 text-palette-accent/85">
                            Drag, click or resize: every change is an action.
                        </p>
                    ) : (
                        <ol aria-label="Actions" className="flex flex-col">
                            {log.map((entry) => (
                                <li
                                    key={entry.n}
                                    className="border-b border-palette-line px-4 py-2"
                                >
                                    <p className="flex gap-2">
                                        <span className="text-palette-accent/85">
                                            {entry.time}
                                        </span>
                                        <span
                                            data-testid="action-type"
                                            className="font-semibold"
                                        >
                                            {entry.type}
                                        </span>
                                    </p>
                                    <p className="break-all text-palette-accent/85">
                                        {entry.data}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    ))}
                {view === "model" && (
                    <pre data-testid="model-json" className="p-4">
                        {json}
                    </pre>
                )}
                {view === "state" && (
                    <ul aria-label="State" className="flex flex-col">
                        {state.map((element, index) => (
                            <li
                                // several elements can share a path (a popout, a tab and its button)
                                // biome-ignore lint/suspicious/noArrayIndexKey: the list is re-read, never reordered in place
                                key={`${element.path}:${index}`}
                                data-state-path={element.path}
                                className="border-b border-palette-line px-4 py-1.5"
                            >
                                <p className="font-semibold">{element.path}</p>
                                {element.attributes.length > 0 && (
                                    <p className="break-all text-palette-accent/85">
                                        {element.attributes
                                            .map(([name, value]) =>
                                                value === ""
                                                    ? name
                                                    : `${name}="${value}"`,
                                            )
                                            .join(" ")}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
