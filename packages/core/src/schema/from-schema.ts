/**
 * The TypeScript type a schema of the {@link JsonSchema} subset describes. Used by the type tests to
 * check each command's hand-written schema against its payload type, so the two cannot drift. It
 * does not follow `$ref`.
 */
export type FromSchema<S> = S extends { readonly const: infer C }
    ? C
    : S extends { readonly enum: readonly (infer E)[] }
      ? E
      : S extends { readonly anyOf: readonly (infer A)[] }
        ? FromSchema<A>
        : S extends { readonly oneOf: readonly (infer A)[] }
          ? FromSchema<A>
          : S extends { readonly type: "object" }
            ? ObjectFromSchema<S>
            : S extends { readonly type: "array"; readonly items: infer I }
              ? FromSchema<I>[]
              : S extends { readonly type: "string" }
                ? string
                : S extends { readonly type: "number" | "integer" }
                  ? number
                  : S extends { readonly type: "boolean" }
                    ? boolean
                    : S extends { readonly type: "null" }
                      ? null
                      : unknown;

type RequiredKeys<S> = S extends { readonly required: readonly (infer R)[] }
    ? R
    : never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type ObjectFromSchema<S> = S extends { readonly properties: infer P }
    ? Simplify<
          {
              -readonly [K in keyof P as K extends RequiredKeys<S>
                  ? K
                  : never]: FromSchema<P[K]>;
          } & {
              -readonly [K in keyof P as K extends RequiredKeys<S>
                  ? never
                  : K]?: FromSchema<P[K]>;
          }
      >
    : Record<string, unknown>;
