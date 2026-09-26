"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import {
    DEFAULT_THEME,
    isThemeName,
    type ThemeName,
} from "@/examples/_themes/themes";
import type { ExampleEntry } from "@/examples/entry-types";
import { LEVEL_TITLES, LEVELS, type Level } from "@/examples/meta-types";
import { cn } from "@/lib/cn";
import { GITHUB_URL } from "@/lib/layout.shared";

// The examples browser's chrome, in the style of the Bryntum examples: the header and the list on
// the left (by level). It is the examples' layout, so it stays mounted while you move between
// examples: the list keeps its scroll and its filter, and the theme and code panel their state.
// Plain markup and Fragiola palettes: it is deliberately NOT built with Dockable, so a package bug
// cannot break the navigation (DD13).

const THEME_KEY = "dockable-docs:example-theme";

export interface ShellState {
    theme: ThemeName;
    code: boolean;
}

/** Reads ?theme= and ?code=1, falling back to the remembered theme. */
function readState(): ShellState {
    const params = new URLSearchParams(window.location.search);
    let stored: string | null = null;
    try {
        stored = window.localStorage.getItem(THEME_KEY);
    } catch {
        // storage unavailable: the URL and the default still work
    }
    const fromUrl = params.get("theme");
    const theme = isThemeName(fromUrl)
        ? fromUrl
        : isThemeName(stored)
          ? stored
          : DEFAULT_THEME;
    return { theme, code: params.get("code") === "1" };
}

export function query(state: ShellState): string {
    const params = new URLSearchParams();
    if (state.theme !== DEFAULT_THEME) params.set("theme", state.theme);
    if (state.code) params.set("code", "1");
    const text = params.toString();
    return text ? `?${text}` : "";
}

export const iconButton =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

interface ShellContextValue {
    state: ShellState;
    setState: (update: (state: ShellState) => ShellState) => void;
    /** the URL and storage were read (client only): the stage may render */
    ready: boolean;
}

const ShellContext = createContext<ShellContextValue | null>(null);

/** The shell state the examples' layout keeps across examples. */
export function useShell(): ShellContextValue {
    const context = useContext(ShellContext);
    if (!context) {
        throw new Error("useShell must be used inside ExamplesChrome");
    }
    return context;
}

function ExampleList({
    examples,
    current,
    state,
    onNavigate,
}: {
    examples: ExampleEntry[];
    current: string;
    state: ShellState;
    onNavigate: () => void;
}) {
    const [filter, setFilter] = useState("");
    const needle = filter.trim().toLowerCase();
    const visible = examples.filter(
        (example) =>
            !needle ||
            example.meta.title.toLowerCase().includes(needle) ||
            example.meta.description.toLowerCase().includes(needle) ||
            example.meta.features.some((f) => f.toLowerCase().includes(needle)),
    );
    const groups = LEVELS.map((level) => ({
        level,
        items: visible.filter((example) => example.meta.level === level),
    }));

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="p-3">
                <label className="flex h-8 items-center gap-2 rounded-md border border-palette-line bg-palette-soft px-2 focus-within:ring-2 focus-within:ring-palette-ring">
                    <Search
                        aria-hidden
                        className="size-4 text-palette-accent/85"
                    />
                    <span className="sr-only">Filter examples</span>
                    <input
                        type="search"
                        value={filter}
                        placeholder="Filter examples"
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-palette-accent/85"
                        onChange={(event) => setFilter(event.target.value)}
                    />
                </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
                {groups.map(({ level, items }) =>
                    items.length === 0 ? null : (
                        <section
                            key={level}
                            className="mb-4"
                            aria-labelledby={`level-${level}`}
                        >
                            <h2
                                id={`level-${level}`}
                                className="flex items-center justify-between px-2 pb-1 text-xs font-semibold tracking-wide text-palette-accent/85 uppercase"
                            >
                                {LEVEL_TITLES[level as Level]}
                                <span className="font-normal">
                                    {items.length}
                                </span>
                            </h2>
                            <ul>
                                {items.map((example) => (
                                    <li key={example.slug}>
                                        <Link
                                            href={`/examples/${example.slug}/${query(state)}`}
                                            aria-current={
                                                example.slug === current
                                                    ? "page"
                                                    : undefined
                                            }
                                            onClick={onNavigate}
                                            className="block rounded-md px-2 py-1.5 text-sm text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-[current=page]:bg-palette-soft aria-[current=page]:font-medium aria-[current=page]:text-palette-contrast"
                                        >
                                            {example.meta.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ),
                )}
                {visible.length === 0 ? (
                    <p className="px-2 text-sm text-palette-accent/85">
                        No example matches.
                    </p>
                ) : null}
            </div>
        </div>
    );
}

export function ExamplesChrome({
    examples,
    children,
}: {
    examples: ExampleEntry[];
    children: ReactNode;
}) {
    // the example's slug: the segment below /examples (none on the index redirect)
    const current = useSelectedLayoutSegment() ?? "";
    const [state, setShellState] = useState<ShellState>({
        theme: DEFAULT_THEME,
        code: false,
    });
    const [ready, setReady] = useState(false);
    const [navOpen, setNavOpen] = useState(false);

    // the URL and storage are client-only: read them once mounted
    useEffect(() => {
        setShellState(readState());
        setReady(true);
    }, []);

    // keep the URL (and the remembered theme) in step with the state, on every example
    // biome-ignore lint/correctness/useExhaustiveDependencies: a new example has a new URL to update
    useEffect(() => {
        if (!ready) return;
        const url = `${window.location.pathname}${query(state)}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", url);
        try {
            window.localStorage.setItem(THEME_KEY, state.theme);
        } catch {
            // storage unavailable: nothing to remember
        }
    }, [state, ready, current]);

    const context: ShellContextValue = {
        state,
        setState: setShellState,
        ready,
    };

    return (
        <ShellContext.Provider value={context}>
            <div className="flex h-dvh flex-col bg-palette-base text-palette-contrast">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b border-palette-line px-3">
                    <button
                        type="button"
                        aria-label="Examples list"
                        aria-expanded={navOpen}
                        className={cn(iconButton, "md:hidden")}
                        onClick={() => setNavOpen((open) => !open)}
                    >
                        <Menu aria-hidden className="size-4" />
                    </button>
                    <Link href="/" className="font-semibold">
                        Dockable
                    </Link>
                    <nav
                        aria-label="Site"
                        className="flex items-center gap-1 ps-3 text-sm"
                    >
                        <Link href="/docs" className={iconButton}>
                            Docs
                        </Link>
                        <Link
                            href="/examples"
                            aria-current="page"
                            className={cn(iconButton, "text-palette-contrast")}
                        >
                            Examples
                        </Link>
                    </nav>
                    <a href={GITHUB_URL} className={cn(iconButton, "ms-auto")}>
                        GitHub
                    </a>
                </header>

                <div className="relative flex min-h-0 flex-1">
                    <nav
                        aria-label="Examples"
                        data-open={navOpen ? "" : undefined}
                        className="palette-surface absolute inset-y-0 start-0 z-40 hidden w-72 border-e border-palette-line bg-palette-base data-open:block md:static md:block md:w-64 md:shrink-0"
                    >
                        <ExampleList
                            examples={examples}
                            current={current}
                            state={state}
                            onNavigate={() => setNavOpen(false)}
                        />
                    </nav>

                    {children}

                    {navOpen ? (
                        <button
                            type="button"
                            aria-label="Close the examples list"
                            className="absolute inset-0 z-30 bg-scrim md:hidden"
                            onClick={() => setNavOpen(false)}
                        >
                            <X aria-hidden className="sr-only" />
                        </button>
                    ) : null}
                </div>
            </div>
        </ShellContext.Provider>
    );
}
