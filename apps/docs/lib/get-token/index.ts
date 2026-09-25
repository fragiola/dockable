// Vendored from the Fragiola UI registry (https://ui.fragiola.com/r/get-token.json, source registry/lib/get-token/index.ts). Do not edit: re-run scripts/vendor-fragiola.ts.
type GetThemeTokenOptionsBase<TFallback> = {
    fallbackReturn?: TFallback;
    /** Element to read the token from. Defaults to documentElement. Palette
     *  roles and chart tokens are declared on `.palette-*` elements — not on
     *  <html> — so a scoped read has to pass the element in. */
    from?: Element | null;
};

type GetThemeTokenOptionsFormatted<TFallback = undefined> =
    GetThemeTokenOptionsBase<TFallback> & {
        formatToNumber: true;
    };

type GetThemeTokenOptionsRaw<TFallback = undefined> =
    GetThemeTokenOptionsBase<TFallback> & {
        formatToNumber?: false;
    };

export function getToken<TFallback>(
    token: string,
    options: GetThemeTokenOptionsFormatted<TFallback>,
): number | TFallback;

export function getToken<TFallback>(
    token: string,
    options?: GetThemeTokenOptionsRaw<TFallback>,
): string | TFallback;

export function getToken<TFallback>(
    token: string,
    options:
        | GetThemeTokenOptionsFormatted<TFallback>
        | GetThemeTokenOptionsRaw<TFallback> = {},
) {
    const {
        fallbackReturn = undefined,
        formatToNumber = false,
        from = null,
    } = options;

    if (typeof getComputedStyle === "undefined") return fallbackReturn;

    const styles = getComputedStyle(from ?? document.documentElement);
    const rawValue = styles.getPropertyValue(token).trim();

    if (!rawValue) return fallbackReturn;

    if (!formatToNumber) return rawValue;

    if (rawValue.endsWith("px")) {
        return parseFloat(rawValue);
    }

    if (rawValue.endsWith("rem")) {
        const htmlFontSize =
            getComputedStyle(document.documentElement).getPropertyValue(
                "font-size",
            ) || "16px";
        const baseFontSize = parseFloat(htmlFontSize);

        return parseFloat(rawValue) * baseFontSize;
    }

    return fallbackReturn;
}
