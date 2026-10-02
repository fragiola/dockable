function isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

/**
 * A copy of a JSON-shaped value: plain objects and arrays are copied (undefined fields dropped),
 * anything else is kept as is. The model copies what callers hand it (`data`, `defaults`), so it
 * never freezes, or shares, an object the caller still owns.
 */
export function cloneJson<V>(value: V): V {
    if (Array.isArray(value)) {
        return value.map(cloneJson) as V;
    }
    if (typeof value === "object" && value !== null && isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const [key, field] of Object.entries(value)) {
            if (field === undefined) {
                continue;
            }
            if (key === "__proto__") {
                // a JSON key like any other: an own property, never the copy's prototype
                Object.defineProperty(out, key, {
                    value: cloneJson(field),
                    enumerable: true,
                    writable: true,
                    configurable: true,
                });
            } else {
                out[key] = cloneJson(field);
            }
        }
        return out as V;
    }
    return value;
}
