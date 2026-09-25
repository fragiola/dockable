// A simulated fleet of services: a small external store (subscribe / getSnapshot, for React's
// useSyncExternalStore) fed by a timer. Deterministic: the same seed gives the same numbers, and
// "trigger an incident" changes the data at once, so nothing waits on a random spike.
// Nothing here knows about Dockable.

export const SERVICES = [
    { id: "api", name: "api-gateway", base: 140 },
    { id: "payments", name: "payments", base: 120 },
    { id: "search", name: "search", base: 180 },
    { id: "auth", name: "auth", base: 90 },
] as const;

export type ServiceId = (typeof SERVICES)[number]["id"];
export type Level = "ok" | "warning" | "critical";
type Mode = "normal" | "degraded" | "incident";

export interface ServiceState {
    /** p95 latency in ms, oldest first */
    latency: number[];
    /** errors per 100 requests */
    errors: number;
    /** CPU use, 0–100 */
    cpu: number;
    mode: Mode;
    level: Level;
    /** open alerts: one per metric over its threshold */
    alerts: number;
}

export interface OpsEvent {
    id: number;
    time: string;
    level: Level | "info";
    text: string;
}

export interface Snapshot {
    tick: number;
    services: Record<ServiceId, ServiceState>;
    events: OpsEvent[];
}

export const THRESHOLDS = { warning: 300, critical: 800 };

const HISTORY = 30;

function clock(tick: number): string {
    const seconds = 9 * 3600 + tick;
    return [seconds / 3600, (seconds / 60) % 60, seconds % 60]
        .map((n) => String(Math.floor(n)).padStart(2, "0"))
        .join(":");
}

export function createSimulation() {
    let seed = 7;
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    const sample = (base: number, mode: Mode) => {
        switch (mode) {
            case "incident":
                return {
                    latency: 900 + random() * 400,
                    errors: 6 + random() * 6,
                };
            case "degraded":
                return {
                    latency: 380 + random() * 150,
                    errors: 1 + random() * 1.5,
                };
            default:
                return {
                    latency: base + random() * 60,
                    errors: random() * 0.8,
                };
        }
    };

    const levelOf = (latency: number, errors: number): [Level, number] => {
        const alerts =
            (latency > THRESHOLDS.warning ? 1 : 0) + (errors > 2 ? 1 : 0);
        const level =
            latency > THRESHOLDS.critical || errors > 5
                ? "critical"
                : alerts > 0
                  ? "warning"
                  : "ok";
        return [level, alerts];
    };

    let eventId = 0;
    const event = (tick: number, level: OpsEvent["level"], text: string) => ({
        id: ++eventId,
        time: clock(tick),
        level,
        text,
    });

    // start with a history, and one service already degraded
    const services = {} as Record<ServiceId, ServiceState>;
    for (const service of SERVICES) {
        const mode: Mode = service.id === "search" ? "degraded" : "normal";
        const latency = Array.from({ length: HISTORY }, () =>
            Math.round(sample(service.base, "normal").latency),
        );
        const last = sample(service.base, mode);
        latency[HISTORY - 1] = Math.round(last.latency);
        const [level, alerts] = levelOf(last.latency, last.errors);
        services[service.id] = {
            latency,
            errors: Math.round(last.errors * 10) / 10,
            cpu: Math.round(30 + random() * 30),
            mode,
            level,
            alerts,
        };
    }
    let snapshot: Snapshot = {
        tick: 0,
        services,
        events: [event(0, "warning", "search: p95 latency over 300 ms")],
    };

    const listeners = new Set<() => void>();
    const notify = () => {
        for (const listener of listeners) listener();
    };

    /** One sample for every service, and an event for every level change. */
    const step = () => {
        const tick = snapshot.tick + 1;
        const events = [...snapshot.events];
        const next = {} as Record<ServiceId, ServiceState>;
        for (const service of SERVICES) {
            const current = snapshot.services[service.id];
            const { latency, errors } = sample(service.base, current.mode);
            const [level, alerts] = levelOf(latency, errors);
            if (level !== current.level) {
                events.push(
                    event(
                        tick,
                        level,
                        level === "ok"
                            ? `${service.name}: recovered`
                            : `${service.name}: p95 ${Math.round(latency)} ms, ${errors.toFixed(1)}% errors`,
                    ),
                );
            }
            next[service.id] = {
                latency: [
                    ...current.latency.slice(1 - HISTORY),
                    Math.round(latency),
                ],
                errors: Math.round(errors * 10) / 10,
                cpu: Math.min(
                    99,
                    Math.round(
                        current.mode === "incident"
                            ? 85 + random() * 14
                            : 30 + random() * 30,
                    ),
                ),
                mode: current.mode,
                level,
                alerts,
            };
        }
        if (tick % 4 === 0) {
            const service = SERVICES[tick % SERVICES.length];
            if (service) {
                events.push(
                    event(tick, "info", `${service.name}: health check passed`),
                );
            }
        }
        snapshot = { tick, services: next, events: events.slice(-200) };
        notify();
    };

    const setMode = (id: ServiceId | "all", mode: Mode) => {
        const services = { ...snapshot.services };
        for (const service of SERVICES) {
            if (id === "all" || service.id === id) {
                services[service.id] = { ...services[service.id], mode };
            }
        }
        snapshot = { ...snapshot, services };
        step(); // apply it now: the effect is visible without waiting for the timer
    };

    return {
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        getSnapshot: () => snapshot,
        /** Streams a sample every `interval` ms; returns the function that stops it. */
        start(interval = 1000) {
            const timer = setInterval(step, interval);
            return () => clearInterval(timer);
        },
        trigger: (id: ServiceId) => setMode(id, "incident"),
        resolveAll: () => setMode("all", "normal"),
    };
}

export type Simulation = ReturnType<typeof createSimulation>;
