<script setup lang="ts">
import { ref } from "vue";
import { Input } from "#/components/atoms/fields";
import PanelBody from "../_kit/PanelBody.vue";
import type { ContactFormData } from "./dockable";
import * as styles from "./styles";

defineProps<{ values: ContactFormData["values"] }>();
const sent = ref(false);
</script>

<template>
    <PanelBody title="Contact">
        <form :class="styles.form" @submit.prevent="sent = true">
            <!-- the initial values, as the `value` attribute (`.attr`): a re-render keeps what the
                 user typed, where the `value` property would reset it -->
            <Input.Template.Simple label="Name" :value.attr="values.name" />
            <Input.Template.Simple
                label="Email"
                type="email"
                :value.attr="values.email"
            />
            <div :class="styles.formActions">
                <button type="submit" :class="styles.submit">Send</button>
                <span role="status" :class="styles.formStatus">
                    {{ sent ? "Sent." : null }}
                </span>
            </div>
        </form>
    </PanelBody>
</template>
