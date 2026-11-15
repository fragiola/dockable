/** The element each key of an engine was last registered with. */
const owners = new WeakMap<object, Map<string, HTMLElement>>();

/**
 * Registers `element` with the engine (`register(element)`) and returns its remover, which
 * unregisters (`register(null)`) only while `element` is still the one registered under `key`.
 *
 * Vue calls a function template ref while it patches, in patch order: when a node moves to
 * another parent (a tab dropped into another tabset), its new element can be attached before
 * its old one is detached, and the old remover must not unregister the new element. (React
 * detaches every removed element before it attaches the new ones.)
 */
export function registerElement(
    engine: object,
    key: string,
    element: HTMLElement,
    register: (element: HTMLElement | null) => void,
): () => void {
    let registered = owners.get(engine);
    if (!registered) {
        registered = new Map();
        owners.set(engine, registered);
    }
    const map = registered;
    map.set(key, element);
    register(element);
    return () => {
        if (map.get(key) === element) {
            map.delete(key);
            register(null);
        }
    };
}
