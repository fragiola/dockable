<script setup lang="ts">
import { useDockable } from "@fragiola/dockable-vue";
import { computed } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Progress } from "#/components/ui/progress";
import { Table } from "#/components/ui/table";
import type { Types } from "./dockable";
import { SERVICES, type ServiceId, type Simulation } from "./simulation";
import * as styles from "./styles";
import { useSimulation } from "./useSimulation";

/** Every service at a glance; a row opens the service's tab. */
const props = defineProps<{ simulation: Simulation }>();
const { model } = useDockable<Types>();
const snapshot = useSimulation(props.simulation);
const rows = computed(() =>
    SERVICES.map((service) => ({
        service,
        state: snapshot.value.services[service.id],
    })),
);

function open(id: ServiceId) {
    if (model.get("node-by", { id: `service-${id}` })) {
        model.run("tab.select", { tabId: `service-${id}` });
    }
}
</script>

<template>
    <div :class="styles.overviewPanel">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Service</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head :class="styles.headEnd">p95</Table.Head>
                    <Table.Head :class="styles.headCpu">CPU</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <Table.Row v-for="{ service, state } in rows" :key="service.id">
                    <Table.Cell :class="styles.cell">
                        <button
                            type="button"
                            :class="styles.serviceLink"
                            @click="open(service.id)"
                        >
                            {{ service.name }}
                        </button>
                    </Table.Cell>
                    <Table.Cell :class="styles.cell">
                        <Badge
                            :class="
                                styles.statusBadge(
                                    state.level,
                                )
                            "
                        >
                            {{ state.level }}
                        </Badge>
                    </Table.Cell>
                    <Table.Cell :class="styles.cellNumber">
                        {{
                            `${state.latency[state.latency.length - 1]} ms`
                        }}
                    </Table.Cell>
                    <Table.Cell :class="styles.cell">
                        <Progress.Root
                            :model-value="state.cpu"
                            :aria-label="`${service.name} CPU`"
                            :class="
                                styles.cpuBar(
                                    state.cpu > 80,
                                )
                            "
                        >
                            <Progress.Track>
                                <Progress.Indicator />
                            </Progress.Track>
                        </Progress.Root>
                    </Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
    </div>
</template>
