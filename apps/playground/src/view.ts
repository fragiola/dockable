import {
    DEFAULT_THEME,
    isThemeName,
    THEMES,
    type ThemeName,
} from "#/examples/_themes/themes";

// What the playground shows, entirely in the URL: a reload restores it and a link reproduces it.
// Defaults are left out of the query.
//
//   ?example=<slug>     an example from examples/react/src/examples
//   &theme=<name>       an example theme (examples/react/src/examples/_themes/themes.ts)
//   &code=1             the source panel
//
// The pre-paint script (examples/react/vite.shared.ts) puts the theme's scheme on <html> before
// the first paint; `applyScheme` owns it afterwards. The example theme itself goes on the stage.

export const KINDS = ["example"] as const;
export type Kind = (typeof KINDS)[number];

export type ItemRef = { kind: Kind; id: string };

export type View = {
    item: ItemRef | null;
    theme: ThemeName;
    code: boolean;
};

export function parseView(search: string): View {
    const params = new URLSearchParams(search);
    const kind = KINDS.find((k) => params.has(k));
    const theme = params.get("theme");
    return {
        item: kind ? { kind, id: params.get(kind) ?? "" } : null,
        theme: isThemeName(theme) ? theme : DEFAULT_THEME,
        code: params.get("code") === "1",
    };
}

export function toSearch(view: View): string {
    const params = new URLSearchParams();
    if (view.item) params.set(view.item.kind, view.item.id);
    if (view.theme !== DEFAULT_THEME) params.set("theme", view.theme);
    if (view.code) params.set("code", "1");
    const query = params.toString();
    return query ? `?${query}` : "?";
}

export function sameItem(a: ItemRef | null, b: ItemRef | null): boolean {
    return a?.kind === b?.kind && a?.id === b?.id;
}

/**
 * The theme's scheme on <html> (`data-theme`, `.dark`): the Fragiola palettes of the shell and of
 * anything portalled out of the stage follow it, as in the embed.
 */
export function applyScheme(theme: ThemeName) {
    const scheme =
        THEMES.find((entry) => entry.name === theme)?.scheme ?? "light";
    const html = document.documentElement;
    html.dataset.theme = scheme;
    html.classList.toggle("dark", scheme === "dark");
}
