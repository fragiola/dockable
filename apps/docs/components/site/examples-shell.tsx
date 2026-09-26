"use client";

import { BookOpen, Code2, Maximize, Minimize, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { THEMES, type ThemeName } from "@/examples/_themes/themes";
import type { ExampleEntry } from "@/examples/entry-types";
import { LEVEL_TITLES } from "@/examples/meta-types";
import { cn } from "@/lib/cn";
import { CodePanel, type SourceFile } from "./code-panel";
import { ExampleStage } from "./example-stage";
import { iconButton, useShell } from "./examples-chrome";

// One example in the examples browser: its title and description, the toolbar (theme, reset,
// fullscreen, code), the live example in the centre and the code on the right. The list around it
// is the examples' layout (examples-chrome.tsx), which stays mounted between examples.

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

export function ExampleView({
    example,
    files,
    themeFiles,
    setup,
}: {
    example: ExampleEntry;
    files: SourceFile[];
    themeFiles: Record<string, SourceFile>;
    setup: string;
}) {
    const { state, setState, ready } = useShell();
    const [resetKey, setResetKey] = useState(0);
    const [fullscreen, setFullscreen] = useState(false);
    const stageFrame = useRef<HTMLDivElement | null>(null);

    // Fullscreen puts the whole page in fullscreen and lays the stage over it,
    // rather than making the stage the fullscreen element: the examples' menus,
    // selects, tooltips and dialogs portal into <body>, and a browser paints
    // nothing outside the fullscreen element. Escape (or leaving fullscreen)
    // restores the page.
    useEffect(() => {
        const onChange = () => {
            if (!document.fullscreenElement) setFullscreen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            // an example that handles Escape itself (a menu, maximize) prevents it
            if (event.key === "Escape" && !event.defaultPrevented)
                setFullscreen(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("fullscreenchange", onChange);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const toggleFullscreen = () => {
        if (fullscreen) {
            setFullscreen(false);
            if (document.fullscreenElement) void document.exitFullscreen();
        } else {
            setFullscreen(true);
            void document.documentElement.requestFullscreen?.().catch(() => {
                // not allowed (an iframe, a browser setting): the overlay still works
            });
        }
    };

    const theme = THEMES.find((t) => t.name === state.theme) ?? THEMES[0];
    const panelFiles = useMemo(() => {
        const themeFile = themeFiles[state.theme];
        return themeFile ? [...files, themeFile] : files;
    }, [files, themeFiles, state.theme]);

    return (
        <>
            <main className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-palette-line px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-palette-soft px-2 py-0.5 text-xs text-palette-accent">
                                {LEVEL_TITLES[example.meta.level]}
                            </span>
                            <h1 className="text-lg">{example.meta.title}</h1>
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
                        <Link href={example.meta.docs} className={iconButton}>
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
                    data-fullscreen={fullscreen ? "" : undefined}
                    className="flex min-h-0 flex-1 bg-palette-soft p-2 data-fullscreen:fixed data-fullscreen:inset-0 data-fullscreen:z-40 md:p-3"
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
                        onClose={() => setState((s) => ({ ...s, code: false }))}
                    />
                ) : null}
            </aside>
        </>
    );
}
