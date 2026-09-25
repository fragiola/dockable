"use client";

import {
    BookOpen,
    Code2,
    Maximize,
    Menu,
    Minimize,
    RotateCcw,
    Search,
    X,
} from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
    DEFAULT_THEME,
    isThemeName,
    THEMES,
    type ThemeName,
} from "@/examples/_themes/themes";
import type { ExampleEntry } from "@/examples/entry-types";
import { LEVEL_TITLES, LEVELS, type Level } from "@/examples/meta-types";
import { cn } from "@/lib/cn";
import { GITHUB_URL } from "@/lib/layout.shared";
import { CodePanel, type SourceFile } from "./code-panel";
import { ExampleStage } from "./example-stage";

// The examples browser, in the style of the Bryntum examples: the list on the
// left (by level), the live example in the centre, the code on the right.
// Plain markup and Fragiola palettes: it is deliberately NOT built with
// Dockable, so a package bug cannot break the navigation (DD13).

const THEME_KEY = "dockable-docs:example-theme";

interface ShellState {
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

function query(state: ShellState): string {
    const params = new URLSearchParams();
    if (state.theme !== DEFAULT_THEME) params.set("theme", state.theme);
    if (state.code) params.set("code", "1");
    const text = params.toString();
    return text ? `?${text}` : "";
}

const iconButton =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-palette-accent/85 outline-none hover:bg-palette-soft hover:text-palette-contrast focus-visible:ring-2 focus-visible:ring-palette-ring aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast";

function ThemeSwitcher({
    value,
    onChange,
}: {
    value: ThemeName;
    onChange: (theme: ThemeName) => void;
}) {
    return (
        <fieldset className="flex flex-wrap items-center gap-1">
            <legend className="sr-only">Theme</legend>
            {THEMES.map((theme) => (
                <button
                    key={theme.name}
                    type="button"
                    aria-pressed={value === theme.name}
                    title={theme.description}
                    data-theme-option={theme.name}
                    className={cn(iconButton, "h-7 px-2 text-xs")}
                    onClick={() => onChange(theme.name)}
                >
                    <span aria-hidden className="flex -space-x-1">
                        {theme.swatch.map((color) => (
                            <span
                                key={color}
                                className="size-3 rounded-full border border-palette-line"
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </span>
                    {theme.title}
                </button>
            ))}
        </fieldset>
    );
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

export function ExamplesShell({
    examples,
    example,
    files,
    themeFiles,
    setup,
}: {
    examples: ExampleEntry[];
    example: ExampleEntry;
    files: SourceFile[];
    themeFiles: Record<string, SourceFile>;
    setup: string;
}) {
    const [state, setState] = useState<ShellState>({
        theme: DEFAULT_THEME,
        code: false,
    });
    const [ready, setReady] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const [resetKey, setResetKey] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const stageFrame = useRef<HTMLDivElement | null>(null);

    // the URL and storage are client-only: read them once mounted
    useEffect(() => {
        setState(readState());
        setReady(true);
    }, []);

    // keep the URL (and the remembered theme) in step with the state
    useEffect(() => {
        if (!ready) return;
        const url = `${window.location.pathname}${query(state)}${window.location.hash}`;
        window.history.replaceState(window.history.state, "", url);
        try {
            window.localStorage.setItem(THEME_KEY, state.theme);
        } catch {
            // storage unavailable: nothing to remember
        }
    }, [state, ready]);

    useEffect(() => {
        const onChange = () =>
            setFullscreen(document.fullscreenElement === stageFrame.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = () => {
        if (document.fullscreenElement) {
            void document.exitFullscreen();
        } else {
            void stageFrame.current?.requestFullscreen?.();
        }
    };

    const theme = THEMES.find((t) => t.name === state.theme) ?? THEMES[0];
    const panelFiles = useMemo(() => {
        const themeFile = themeFiles[state.theme];
        return themeFile ? [...files, themeFile] : files;
    }, [files, themeFiles, state.theme]);

    const nav: ReactNode = (
        <ExampleList
            examples={examples}
            current={example.slug}
            state={state}
            onNavigate={() => setNavOpen(false)}
        />
    );

    return (
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
                    {nav}
                </nav>

                <main className="flex min-w-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-palette-line px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-palette-soft px-2 py-0.5 text-xs text-palette-accent">
                                    {LEVEL_TITLES[example.meta.level]}
                                </span>
                                <h1 className="text-lg">
                                    {example.meta.title}
                                </h1>
                            </div>
                            <p className="mt-1 max-w-3xl text-sm text-palette-accent/85">
                                {example.meta.description}
                            </p>
                            <ul
                                aria-label="Features"
                                className="mt-2 flex flex-wrap gap-1"
                            >
                                {example.meta.features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="rounded border border-palette-line px-1.5 py-0.5 font-mono text-[11px] text-palette-accent/85"
                                    >
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {example.meta.docs ? (
                            <Link
                                href={example.meta.docs}
                                className={iconButton}
                            >
                                <BookOpen aria-hidden className="size-4" />
                                Read the guide
                            </Link>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-b border-palette-line px-3 py-1.5">
                        <ThemeSwitcher
                            value={state.theme}
                            onChange={(value) =>
                                setState((s) => ({ ...s, theme: value }))
                            }
                        />
                        <div className="ms-auto flex items-center gap-1">
                            <button
                                type="button"
                                data-testid="reset"
                                className={iconButton}
                                onClick={() => setResetKey((key) => key + 1)}
                            >
                                <RotateCcw aria-hidden className="size-4" />
                                Reset
                            </button>
                            <button
                                type="button"
                                aria-pressed={fullscreen}
                                className={iconButton}
                                onClick={toggleFullscreen}
                            >
                                {fullscreen ? (
                                    <Minimize aria-hidden className="size-4" />
                                ) : (
                                    <Maximize aria-hidden className="size-4" />
                                )}
                                Fullscreen
                            </button>
                            <button
                                type="button"
                                data-testid="toggle-code"
                                aria-pressed={state.code}
                                aria-controls="example-code"
                                className={iconButton}
                                onClick={() =>
                                    setState((s) => ({ ...s, code: !s.code }))
                                }
                            >
                                <Code2 aria-hidden className="size-4" />
                                Code
                            </button>
                        </div>
                    </div>

                    <div
                        ref={stageFrame}
                        className="flex min-h-0 flex-1 bg-palette-soft p-2 md:p-3"
                    >
                        <div
                            data-testid="stage"
                            data-example-theme={theme.name}
                            className="palette-surface grid min-h-0 flex-1 overflow-hidden rounded-lg border border-palette-line bg-palette-base text-palette-contrast [grid-template:minmax(0,1fr)/minmax(0,1fr)]"
                        >
                            {ready ? (
                                <ExampleStage
                                    key={`${example.slug}:${resetKey}`}
                                    slug={example.slug}
                                />
                            ) : null}
                        </div>
                    </div>
                </main>

                <aside
                    id="example-code"
                    aria-label="Example code"
                    data-open={state.code ? "" : undefined}
                    className="palette-surface absolute inset-0 z-40 hidden bg-palette-base data-open:block md:static md:w-[min(46rem,46%)] md:shrink-0 md:border-s md:border-palette-line"
                >
                    {state.code ? (
                        <CodePanel
                            files={panelFiles}
                            setup={setup}
                            onClose={() =>
                                setState((s) => ({ ...s, code: false }))
                            }
                        />
                    ) : null}
                </aside>

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
    );
}
