import { AnyUseQueryOptions } from "@tanstack/react-query"
import { DBQueryConfig, type ExtractTablesWithRelations } from "drizzle-orm"

import { NeonQueryContextType } from "../lib/neon-query-provider"

import { useDelete } from "./use-delete"
import { useFindFirst } from "./use-find-first"
import { useFindMany } from "./use-find-many"
import { useInsert } from "./use-insert"
import { useMutate } from "./use-mutate"
import { useUpdate } from "./use-update"

export function createQueryHooks<TFullSchema extends Record<string, unknown>>(schema: TFullSchema) {
    type TSchema = ExtractTablesWithRelations<TFullSchema>

    return {
        useFindMany:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null,
                context?: NeonQueryContextType | null
            ) => useFindMany(schema, table, config, options, context),
        useFindFirst:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                id?: TSchema[TableName]["columns"]["id"]["_"]["data"] | null,
                config?: TConfig | null,
                options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null,
                context?: NeonQueryContextType | null
            ) => useFindFirst(schema, table, id, config, options, context),
        useInsert:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useInsert(schema, table, config, context),
        useUpdate:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useUpdate(schema, table, config, context),
        useDelete:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useDelete(schema, table, config, context),
        useMutate:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useMutate(schema, table, config, context)
    }
}