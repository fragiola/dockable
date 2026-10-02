import { describe, expect, it } from "vitest";
import type { JsonSchema } from "../../src/schema/types";
import { joinPointer, validate } from "../../src/schema/validator";

describe("the schema validator", () => {
    it("checks types", () => {
        const cases: [JsonSchema, unknown, string][] = [
            [{ type: "string" }, 1, "must be a string"],
            [{ type: "number" }, "1", "must be a number"],
            [{ type: "number" }, Number.NaN, "must be a number"],
            [{ type: "integer" }, 1.5, "must be an integer"],
            [{ type: "boolean" }, 0, "must be a boolean"],
            [{ type: "null" }, undefined, "must be null"],
            [{ type: "object" }, [], "must be an object"],
            [{ type: "array" }, {}, "must be an array"],
        ];
        for (const [schema, value, message] of cases) {
            expect(validate(schema, value)).toEqual([{ path: "", message }]);
        }
        expect(validate({ type: "integer" }, 3)).toEqual([]);
    });

    it("checks bounds, enums and constants", () => {
        expect(validate({ type: "number", minimum: 0 }, -1)).toEqual([
            { path: "", message: "must be >= 0" },
        ]);
        expect(validate({ type: "number", exclusiveMinimum: 0 }, 0)).toEqual([
            { path: "", message: "must be > 0" },
        ]);
        expect(validate({ type: "string", minLength: 2 }, "a")).toEqual([
            { path: "", message: "must have at least 2 character(s)" },
        ]);
        expect(validate({ type: "array", minItems: 1 }, [])).toEqual([
            { path: "", message: "must have at least 1 item(s)" },
        ]);
        expect(validate({ enum: ["a", "b"] }, "c")).toEqual([
            { path: "", message: 'must be one of "a", "b"' },
        ]);
        expect(validate({ const: 1 }, 2)).toEqual([
            { path: "", message: "must be 1" },
        ]);
        expect(validate({ const: { a: [1] } }, { a: [1] })).toEqual([]);
    });

    it("checks objects: required, closed, nested, with JSON pointers", () => {
        const schema: JsonSchema = {
            type: "object",
            properties: {
                "a/b": { type: "string" },
                list: { type: "array", items: { type: "number" } },
            },
            required: ["a/b"],
            additionalProperties: false,
        };
        expect(validate(schema, { list: [1, "x"], extra: 1 })).toEqual([
            { path: "/a~1b", message: "is required" },
            { path: "/list/1", message: "must be a number" },
            { path: "/extra", message: "is not allowed" },
        ]);
        expect(joinPointer("/x", "a~b")).toBe("/x/a~0b");
    });

    it("resolves local $refs, including recursive ones", () => {
        const tree: JsonSchema = {
            $defs: {
                node: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        children: {
                            type: "array",
                            items: { $ref: "#/$defs/node" },
                        },
                    },
                    additionalProperties: false,
                },
            },
            $ref: "#/$defs/node",
        };
        expect(
            validate(tree, {
                name: "a",
                children: [{ name: "b", children: [{ name: 3 }] }],
            }),
        ).toEqual([
            {
                path: "/children/0/children/0/name",
                message: "must be a string",
            },
        ]);
        expect(validate({ $ref: "#/$defs/missing" }, 1)).toEqual([
            { path: "", message: "unresolved $ref #/$defs/missing" },
        ]);
    });

    it("reports the alternative a value's type names", () => {
        const schema: JsonSchema = {
            anyOf: [
                {
                    type: "object",
                    properties: { type: { const: "a" }, x: { type: "number" } },
                    additionalProperties: false,
                },
                {
                    type: "object",
                    properties: { type: { const: "b" }, y: { type: "string" } },
                    additionalProperties: false,
                },
            ],
        };
        expect(validate(schema, { type: "b", y: 1 })).toEqual([
            { path: "/y", message: "must be a string" },
        ]);
        expect(
            validate({ anyOf: [{ type: "string" }, { const: null }] }, 1),
        ).toEqual([{ path: "", message: "must be a string or must be null" }]);
        expect(
            validate({ oneOf: [{ type: "number" }, { type: "integer" }] }, 1),
        ).toEqual([{ path: "", message: "must match exactly one shape" }]);
    });

    it("reports the alternative whose keys the value has", () => {
        const schema: JsonSchema = {
            anyOf: [
                {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        data: { type: "object" },
                    },
                    required: ["id", "data"],
                    additionalProperties: false,
                },
                {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        kind: { type: "string" },
                    },
                    required: ["id", "kind"],
                    additionalProperties: false,
                },
            ],
        };
        expect(validate(schema, { id: "a", data: 1 })).toEqual([
            { path: "/data", message: "must be an object" },
        ]);
        expect(validate(schema, { id: "a", kind: 2 })).toEqual([
            { path: "/kind", message: "must be a string" },
        ]);
        // fitting neither alternative's keys
        expect(validate(schema, { id: "a" })).toEqual([
            { path: "", message: "does not match any allowed shape" },
        ]);
    });

    it("refuses a value that matches `not` (`not: {}`: the property must be absent)", () => {
        const schema: JsonSchema = {
            type: "object",
            properties: { a: { not: {} }, b: { not: { type: "string" } } },
        };
        expect(validate(schema, {})).toEqual([]);
        expect(validate(schema, { b: 1 })).toEqual([]);
        expect(validate(schema, { a: 1, b: "x" })).toEqual([
            { path: "/a", message: "is not allowed" },
            { path: "/b", message: "is not allowed" },
        ]);
    });

    it("reads own keys only: an inherited name is neither a property nor a required key", () => {
        const schema: JsonSchema = {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
            additionalProperties: false,
        };
        expect(
            validate(schema, JSON.parse('{"__proto__":{"path":"/x"}}')),
        ).toEqual([
            { path: "/path", message: "is required" },
            { path: "/__proto__", message: "is not allowed" },
        ]);
        expect(
            validate({ type: "object", required: ["toString"] }, {}),
        ).toEqual([{ path: "/toString", message: "is required" }]);
    });

    it("treats an undefined property as absent", () => {
        expect(
            validate(
                {
                    type: "object",
                    properties: { a: { type: "string" } },
                    required: ["a"],
                },
                { a: undefined },
            ),
        ).toEqual([{ path: "/a", message: "is required" }]);
    });
});
