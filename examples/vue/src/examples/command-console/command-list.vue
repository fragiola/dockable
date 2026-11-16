<script setup lang="ts" generic="T extends DockableTypes">
import type { DockableTypes, Model } from "@fragiola/dockable-vue";
import * as styles from "./styles";
import { fieldsOf } from "./tools";

defineProps<{ model: Model<T> }>();
</script>

<template>
    <ul data-testid="command-list" :class="styles.commandList">
        <li
            v-for="command in model.get('commands')"
            :key="command.name"
            :data-command="command.name"
            :class="styles.command"
        >
            <p :class="styles.commandName">
                {{ command.name
                }}<span v-if="command.transient" :class="styles.commandTransient">
                    transient-capable
                </span>
            </p>
            <p :class="styles.commandDescription">{{ command.description }}</p>
            <dl :class="styles.commandFields">
                <div
                    v-for="field in fieldsOf(command.payloadSchema)"
                    :key="field.name"
                    :class="styles.commandField"
                >
                    <dt :title="field.description">
                        {{ field.name }}{{ field.required ? "" : "?" }}
                    </dt>
                    <dd :class="styles.commandFieldType">{{ field.type }}</dd>
                </div>
            </dl>
        </li>
    </ul>
</template>
