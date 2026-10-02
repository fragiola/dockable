import type { CommandError } from "../commands/types";

export function refused(message: string): { ok: false; error: CommandError } {
    return { ok: false, error: { code: "refused", message } };
}

export function notFound(message: string): { ok: false; error: CommandError } {
    return { ok: false, error: { code: "not_found", message } };
}
