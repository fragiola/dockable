import { useEffect, useMemo, useState } from "react";
import { Clickable } from "#/components/atoms/clickable";
import type { InspectedEvent, InspectedModel } from "./context";

// The Inspector: what the model does while you use the layout. Three views, all plain text:
//
//   Commands  every command the model commits (engine-issued or a direct `model.run` alike,
//             through `model.subscribe`), newest first: its name, payload and result, and whether
//             it was transient (a step of a gesture); a batch lists the commands it ran
//   Model     `model.get("layout-json")` after the last command
//   State     each `[data-layout-path]` element of the stage with its `data-*` and ARIA
//             attributes, re-read on every attribute change, so drag and drop state shows while
//             it happens
//
// The App keys the panel by entry: switching starts from an empty log, and the listener and the
// observer of the previous entry are gone.

const MAX_COMMANDS = 200;

const VIEWS = ["commands", "model", "state"] as const;
type ViewName = (typeof VIEWS)[number];
const VIEW_TITLES: Record<ViewName, string> = {
    commands: "Commands",
    model: "Model",
    state: "State",
};

const PRESSED =
    "aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

type LoggedCommand = {
    n: number;
    time: string;
    name: string;
    transient: boolean;
    payload: string;
    result: string;
    /** a batch's commands, flattened */
    steps: string[];
};

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

function entry(n: number, event: InspectedEvent): LoggedCommand {
    return {
        n,
        time: time(),
        name: event.command,
        transient: event.transient,
        payload: stringify(event.payload),
        result: stringify(event.result),
        steps: (event.commands ?? []).map(
            (step) => `${step.command} ${stringify(step.payload)}`,
        ),
    };
}

/** Every command the model commits, newest first, and a counter that moves with each. */
function useCommands(model: InspectedModel) {
    const [log, setLog] = useState<LoggedCommand[]>([]);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        // a new model (the entry remounted: Retry, a Fast Refresh that resets state) starts a new
        // log; the old entries describe a model that is gone, and their keys would repeat
        setLog([]);
        let n = 0;
        return model.subscribe((event) => {
            n += 1;
            const logged = entry(n, event);
            setLog((current) => [logged, ...current].slice(0, MAX_COMMANDS));
            setVersion((v) => v + 1);
        });
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
    model: InspectedModel;
    stage: HTMLElement | null;
}) {
    const [view, setView] = useState<ViewName>("commands");
    const { log, version, clear } = useCommands(model);
    const state = useLayoutState(stage, view === "state");
    // biome-ignore lint/correctness/useExhaustiveDependencies: `version` moves with each command (`model.state` is replaced)
    const json = useMemo(
        () => (view === "model" ? stringify(model.get("layout-json"), 2) : ""),
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
                {view === "commands" && (
                    <>
                        <span
                            data-testid="command-count"
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
                {view === "commands" &&
                    (log.length === 0 ? (
                        <p className="p-4 text-palette-accent/85">
                            Drag, click or resize: every change is a command.
                        </p>
                    ) : (
                        <ol aria-label="Commands" className="flex flex-col">
                            {log.map((logged) => (
                                <li
                                    key={logged.n}
                                    className="border-b border-palette-line px-4 py-2"
                                >
                                    <p className="flex gap-2">
                                        <span className="text-palette-accent/85">
                                            {logged.time}
                                        </span>
                                        <span
                                            data-testid="command-name"
                                            className="font-semibold"
                                        >
                                            {logged.name}
                                        </span>
                                        {logged.transient && (
                                            <span
                                                data-testid="command-transient"
                                                className="text-palette-accent/85"
                                            >
                                                transient
                                            </span>
                                        )}
                                    </p>
                                    <p className="break-all text-palette-accent/85">
                                        {logged.payload}
                                    </p>
                                    {logged.steps.length > 0 && (
                                        <ol className="list-inside list-decimal break-all text-palette-accent/85">
                                            {logged.steps.map((step, index) => (
                                                <li
                                                    // biome-ignore lint/suspicious/noArrayIndexKey: a logged batch never changes
                                                    key={index}
                                                >
                                                    {step}
                                                </li>
                                            ))}
                                        </ol>
                                    )}
                                    <p className="break-all">
                                        {`→ ${logged.result}`}
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
