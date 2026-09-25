import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../examples/_themes/themes";
import { blend, contrast, oklchToSrgb, parseOklch, type RGB } from "./color";

// The theme contract (DD10): every palette of every theme declares the six
// roles, every theme declares the same palettes and shape tokens, and text
// meets WCAG AA on the surfaces it is drawn on.

const DIR = join(import.meta.dirname, "../examples/_themes");
const ROLES = ["base", "soft", "line", "contrast", "accent", "ring"] as const;
const TOKENS = [
    "font",
    "tab-font",
    "tab-size",
    "radius",
    "tab-radius",
    "tab-height",
    "tab-gap",
    "gap",
    "border",
    "shadow",
    "splitter-size",
    "splitter-grab",
    "splitter-bg",
    "grip",
    "strip-padding",
    "indicator-style",
    "motion",
];
const NEUTRAL = ["surface", "raised"];

type Palettes = Map<string, Map<string, string>>;

function parse(name: string): { palettes: Palettes; tokens: Set<string> } {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8");
    const palettes: Palettes = new Map();
    const block = new RegExp(
        String.raw`:root \[data-example-theme="${name}"\] \.palette-([a-z-]+),[^{]*\{([^}]*)\}`,
        "g",
    );
    for (const [, palette, body] of css.matchAll(block)) {
        const roles = new Map<string, string>();
        for (const [, role, value] of (body ?? "").matchAll(
            /--palette-([a-z]+):\s*([^;]+);/g,
        )) {
            roles.set(role ?? "", value ?? "");
        }
        palettes.set(palette ?? "", roles);
    }
    const tokens = new Set(
        [...css.matchAll(/--dk-([a-z-]+):/g)].map(([, token]) => token ?? ""),
    );
    return { palettes, tokens };
}

function color(roles: Map<string, string>, role: string): RGB {
    return oklchToSrgb(parseOklch(roles.get(role) ?? ""));
}

const parsed = THEMES.map((theme) => ({ theme, ...parse(theme.name) }));
const reference = parsed[0];

describe.each(parsed)("theme $theme.name", ({ palettes, tokens }) => {
    it("declares the same palettes as the others", () => {
        expect([...palettes.keys()].sort()).toEqual(
            [...(reference?.palettes.keys() ?? [])].sort(),
        );
        expect(palettes.size).toBeGreaterThanOrEqual(7);
    });

    it("declares all six roles in every palette", () => {
        for (const [palette, roles] of palettes) {
            expect([...roles.keys()].sort(), palette).toEqual(
                [...ROLES].sort(),
            );
        }
    });

    it("declares every shape token", () => {
        expect([...tokens].sort()).toEqual([...TOKENS].sort());
    });

    it("draws contrast text on base at AA (4.5:1) in every palette", () => {
        for (const [palette, roles] of palettes) {
            const ratio = contrast(
                color(roles, "contrast"),
                color(roles, "base"),
            );
            expect(
                ratio,
                `${palette}: contrast on base`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("draws secondary text (accent/85) at AA on the neutral surfaces", () => {
        for (const palette of NEUTRAL) {
            const roles = palettes.get(palette);
            expect(roles, palette).toBeDefined();
            if (!roles) continue;
            for (const background of ["base", "soft"]) {
                const bg = color(roles, background);
                const text = blend(color(roles, "accent"), bg, 0.85);
                expect(
                    contrast(text, bg),
                    `${palette}: accent/85 on ${background}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});
