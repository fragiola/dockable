import type { CommandInfo, JsonSchema } from "@fragiola/dockable";

// Everything here is plain data from `model.commands()`: each command's name, description and
// JSON Schemas. Nothing is Dockable-specific beyond that list.

/** A payload field as the console lists it. */
export interface Field {
    name: string;
    type: string;
    required: boolean;
    description: string | undefined;
}

/** A short, readable type for a schema: `string`, `integer`, `"center" | "top"`, `object[]`, … */
export function typeOf(schema: JsonSchema): string {
    if (schema.$ref) {
        return schema.$ref.replace("#/$defs/", "");
    }
    if (schema.const !== undefined) {
        return JSON.stringify(schema.const);
    }
    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
    }
    const alternatives = schema.anyOf ?? schema.oneOf;
    if (alternatives) {
        return [...new Set(alternatives.map(typeOf))].join(" | ");
    }
    if (schema.type === "array") {
        return `${schema.items ? typeOf(schema.items) : "unknown"}[]`;
    }
    return schema.type ?? "any JSON";
}

/** The top-level fields of a command's payload. */
export function fieldsOf(schema: JsonSchema): Field[] {
    const required = new Set(schema.required ?? []);
    return Object.entries(schema.properties ?? {}).map(([name, field]) => ({
        name,
        type: typeOf(field),
        required: required.has(name),
        description: field.description,
    }));
}

/**
 * A command as a tool an assistant can call: the provider-neutral shape most tool-calling APIs
 * take. Tool names may not contain dots, so `tab.select` becomes `tab_select`.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: JsonSchema;
}

export function toolName(command: string): string {
    return command.replace(".", "_");
}

export function toTools(commands: readonly CommandInfo[]): ToolDefinition[] {
    return commands.map((command) => ({
        name: toolName(command.name),
        description: command.description,
        input_schema: command.payloadSchema,
    }));
}

/**
 * What an assistant's tool call becomes: the command it names and its input as the payload,
 * ready for `model.dispatch`, which validates it like any untrusted JSON.
 */
export function fromToolCall(
    commands: readonly CommandInfo[],
    call: { name: string; input: unknown },
): { command: string; payload: unknown } {
    const command =
        commands.find((info) => toolName(info.name) === call.name)?.name ??
        call.name;
    return { command, payload: call.input };
}
