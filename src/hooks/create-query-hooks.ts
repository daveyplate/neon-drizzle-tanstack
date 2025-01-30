import { AnyUseQueryOptions } from "@tanstack/react-query"
import { DBQueryConfig, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import { NeonQueryContextType } from "../lib/neon-query-provider"

import { useDelete } from "./use-delete"
import { useFindFirst } from "./use-find-first"
import { useFindMany } from "./use-find-many"
import { useInsert } from "./use-insert"
import { useUpdate } from "./use-update"

export function createQueryHooks<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
>(db: PgDatabase<TQueryResult, TFullSchema, TSchema>) {
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
            ) => useFindMany(db, table, config, options, context),
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
            ) => useFindFirst(db, table, id, config, options, context),
        useInsert:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useInsert(db, table, config, context),
        useUpdate:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useUpdate(db, table, config, context),
        useDelete:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig | null,
                context?: NeonQueryContextType | null
            ) => useDelete(db, table, config, context)
    }
}