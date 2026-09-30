import type { NodeKind } from "./types";

/** What an id is generated for: a node kind, or a popout window. */
export type IdKind = NodeKind | "window";

/**
 * Generates the id of a node (or window) created without one. The model skips an id already in
 * use and asks again.
 */
export type CreateId = (kind: IdKind) => string;

/** How many times a custom generator is asked before the default takes over. */
const ATTEMPTS = 100;

/**
 * The ids of one model. The default generator is deterministic and needs no `crypto`:
 * `` `${kind}-${n}` `` with one counter per kind.
 */
export class IdSource {
    private readonly counters = new Map<IdKind, number>();
    private readonly custom: CreateId | undefined;

    constructor(createId?: CreateId) {
        this.custom = createId;
    }

    /** A fresh id for `kind`, for which `isUsed` is false. */
    next(kind: IdKind, isUsed: (id: string) => boolean): string {
        if (this.custom) {
            for (let i = 0; i < ATTEMPTS; i++) {
                const id = this.custom(kind);
                if (typeof id === "string" && id !== "" && !isUsed(id)) {
                    return id;
                }
            }
        }
        for (;;) {
            const n = (this.counters.get(kind) ?? 0) + 1;
            this.counters.set(kind, n);
            const id = `${kind}-${n}`;
            if (!isUsed(id)) {
                return id;
            }
        }
    }
}
