import { onUnmounted, type Ref, shallowRef } from "vue";
import type { Simulation, Snapshot } from "./simulation";

// The content of each tab reads the simulation through this composable: it subscribes, and
// unsubscribes when the panel unmounts.

/** The simulation's current snapshot, as a ref that follows it. */
export function useSimulation(simulation: Simulation): Readonly<Ref<Snapshot>> {
    const snapshot = shallowRef(simulation.getSnapshot());
    onUnmounted(
        simulation.subscribe(() => {
            snapshot.value = simulation.getSnapshot();
        }),
    );
    return snapshot;
}
