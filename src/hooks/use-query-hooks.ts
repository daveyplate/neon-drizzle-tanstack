import { TablesRelationalConfig, DBQueryConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import { AnyUseQueryOptions } from "@tanstack/react-query"

import { useFindMany } from "./use-find-many"
import { useFindFirst } from "./use-find-first"

export function createQueryHooks<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>
) {
    return {
        useFindMany:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                config?: TConfig,
                options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
            ) => useFindMany(db, table, config, options),
        useFindFirst:
            <
                TableName extends keyof TSchema,
                TConfig extends DBQueryConfig<"one", true, TSchema, TSchema[TableName]>
            >(
                table?: TableName | null | false | "",
                id?: TSchema[TableName]["columns"]["id"]["_"]["data"] | null,
                config?: TConfig | null,
                options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
            ) => useFindFirst(db, table, id, config, options)
    }
}

// initialData: options?.initialData || (() => {
//     const queriesData = queryClient.getQueriesData<{ id: unknown }[]>({
//         queryKey: [table, "list"],
//         exact: false
//     })

//     return queriesData?.flatMap(data => data?.[1])?.find(item => item?.id === id) as TableType
// }),
// initialDataUpdatedAt: options?.initialDataUpdatedAt || (() => {
//     // ⬇️ get the last fetch time of the list
//     const dataUpdatedAt = queryClient.getQueryState([table, "list", config])?.dataUpdatedAt ||
//         queryClient.getQueryCache().find({ queryKey: [table, "list"], exact: false })?.state?.dataUpdatedAt
//     if (dataUpdatedAt) {
//         const timeSinceUpdateInSeconds = (Date.now() - dataUpdatedAt) / 1000
//         console.log("timeSinceUpdateInSeconds", timeSinceUpdateInSeconds)
//     }
//     return dataUpdatedAt
// }),