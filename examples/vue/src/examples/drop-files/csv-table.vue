<script setup lang="ts">
import { Table } from "#/components/ui/table";
import type { Csv } from "./files";
import * as styles from "./styles";

defineProps<{ csv: Csv }>();
</script>

<template>
    <div :class="styles.tableWrap">
        <Table.Root>
            <Table.Header>
                <Table.Row>
                    <!-- by position: a header may repeat a name or be empty; columns never reorder -->
                    <Table.Head v-for="(column, cell) in csv.columns" :key="cell">
                        {{ column }}
                    </Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                <!-- rows of a file, never reordered; cells of a row, by column -->
                <Table.Row v-for="(row, index) in csv.rows" :key="index">
                    <Table.Cell v-for="(_, cell) in csv.columns" :key="cell">
                        {{ row[cell] }}
                    </Table.Cell>
                </Table.Row>
            </Table.Body>
        </Table.Root>
    </div>
</template>
