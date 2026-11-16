<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Table } from "#/components/ui/table";
import { ORDERS } from "./data";
import { useFilters } from "./filters";
import * as styles from "./styles";

/** A Fragiola table of the orders in the selected region. */
const filters = useFilters();
const rows = computed(() =>
    ORDERS.filter(
        (order) =>
            filters.value.region === "all" ||
            order.region === filters.value.region,
    ),
);
</script>

<template>
    <div :class="styles.orders">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Order</Table.Head>
                    <Table.Head>Customer</Table.Head>
                    <Table.Head>Region</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head :class="styles.amountHead">Amount</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <Table.Row v-for="order in rows" :key="order.id">
                    <Table.Cell :class="styles.orderId">{{ order.id }}</Table.Cell>
                    <Table.Cell>{{ order.customer }}</Table.Cell>
                    <Table.Cell>{{ order.region }}</Table.Cell>
                    <Table.Cell>
                        <Badge :class="styles.orderStatus[order.status]">
                            {{ order.status }}
                        </Badge>
                    </Table.Cell>
                    <Table.Cell :class="styles.amount">
                        {{ `$${order.amount}` }}
                    </Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
    </div>
</template>
