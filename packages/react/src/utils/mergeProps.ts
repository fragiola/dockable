type AnyProps = Record<string, unknown>;

function isHandler(
    key: string,
    value: unknown,
): value is (...args: unknown[]) => void {
    return /^on[A-Z]/.test(key) && typeof value === "function";
}

/**
 * Merges `external` props over `internal` ones: plain props from `external` win, event handlers
 * are composed (internal first, then external) and class names are joined.
 */
export function mergeProps(internal: AnyProps, external: AnyProps): AnyProps {
    const merged: AnyProps = { ...internal };
    for (const [key, value] of Object.entries(external)) {
        const current = merged[key];
        if (value === undefined) {
            continue;
        }
        if (isHandler(key, value) && isHandler(key, current)) {
            merged[key] = (...args: unknown[]) => {
                current(...args);
                value(...args);
            };
        } else if (
            key === "className" &&
            typeof current === "string" &&
            typeof value === "string"
        ) {
            merged.className = `${current} ${value}`;
        } else {
            merged[key] = value;
        }
    }
    return merged;
}
