"use client";

import Link from "next/link";
import { useState } from "react";
import { THEMES, type ThemeName } from "@/examples/_themes/themes";
import { cn } from "@/lib/cn";
import { ExampleStage } from "../site/example-stage";

// The landing page's live demo: one Advanced example, client-only, with the
// theme switcher, to show on the first screen that every pixel is the
// consumer's.

export function LiveDemo({
    slug,
    initialTheme,
}: {
    slug: string;
    initialTheme: ThemeName;
}) {
    const [theme, setTheme] = useState<ThemeName>(initialTheme);
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1">
                <span className="pe-2 text-sm text-palette-accent/85">
                    Same markup, five themes:
                </span>
                {THEMES.map((option) => (
                    <button
                        key={option.name}
                        type="button"
                        aria-pressed={theme === option.name}
                        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-palette-accent/85 outline-none hover:bg-palette-soft focus-visible:ring-2 focus-visible:ring-palette-ring aria-pressed:bg-palette-soft aria-pressed:text-palette-contrast"
                        onClick={() => setTheme(option.name)}
                    >
                        <span aria-hidden className="flex -space-x-1">
                            {option.swatch.map((color) => (
                                <span
                                    key={color}
                                    className="size-3 rounded-full border border-palette-line"
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </span>
                        {option.title}
                    </button>
                ))}
                <Link
                    href={`/examples/${slug}/?theme=${theme}&code=1`}
                    className="ms-auto text-sm underline-offset-4 hover:underline"
                >
                    See the code →
                </Link>
            </div>
            <div
                data-example-theme={theme}
                data-testid="stage"
                className={cn(
                    "palette-surface grid h-[34rem] overflow-hidden rounded-xl border border-palette-line bg-palette-base text-palette-contrast shadow-lg",
                    "[grid-template:minmax(0,1fr)/minmax(0,1fr)]",
                )}
            >
                <ExampleStage slug={slug} />
            </div>
        </div>
    );
}
