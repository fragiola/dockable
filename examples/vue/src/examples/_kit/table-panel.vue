<script setup lang="ts">
// Demo content: a Fragiola UI table of orders.
import { Table } from "#/components/ui/table";
import { ORDERS, type Row } from "./data";

withDefaults(defineProps<{ rows?: Row[] }>(), { rows: () => ORDERS });
</script>

<template>
    <div class="p-3">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Order</Table.Head>
                    <Table.Head>Customer</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head class="text-end">Amount</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <Table.Row v-for="row in rows" :key="row.id">
                    <Table.Cell>{{ row.id }}</Table.Cell>
                    <Table.Cell>{{ row.name }}</Table.Cell>
                    <Table.Cell>{{ row.status }}</Table.Cell>
                    <Table.Cell class="text-end tabular-nums">{{
                        `$${row.amount}`
                    }}</Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
    </div>
</template>
