/** A JSON value. */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

/** The JSON Schema types the validator knows. */
export type JsonSchemaType =
    | "object"
    | "array"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null";

/**
 * The subset of JSON Schema (2020-12) that Dockable's schemas use and its validator checks. Other
 * keywords may be present (a consumer's data schema can carry them); they are ignored.
 */
export interface JsonSchema {
    readonly $ref?: string;
    readonly $defs?: { readonly [name: string]: JsonSchema };
    readonly title?: string;
    readonly description?: string;
    readonly type?: JsonSchemaType;
    readonly properties?: { readonly [name: string]: JsonSchema };
    readonly required?: readonly string[];
    readonly additionalProperties?: boolean;
    readonly enum?: readonly JsonValue[];
    readonly const?: JsonValue;
    readonly items?: JsonSchema;
    readonly oneOf?: readonly JsonSchema[];
    readonly anyOf?: readonly JsonSchema[];
    readonly minimum?: number;
    readonly exclusiveMinimum?: number;
    readonly minLength?: number;
    readonly minItems?: number;
}

/** A problem found in a document: where (a JSON pointer, RFC 6901) and what. */
export interface ValidationIssue {
    readonly path: string;
    readonly message: string;
}
