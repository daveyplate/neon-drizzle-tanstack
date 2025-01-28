import { TablesRelationalConfig, DBQueryConfig, BuildQueryResult, eq, sql } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { skipToken, useQuery } from "@tanstack/react-query"
import { neonConfig } from "@neondatabase/serverless"
import { NeonHttpDatabase } from "drizzle-orm/neon-http"

import { AnyUseQueryOptions, useQueryClient } from "@tanstack/react-query"

import { NeonQueryContext } from "../lib/neon-query-provider"
import { useContext, useEffect } from "react"
import { findMany, findFirst } from "../lib/db-queries"
import { serializeConfig } from "../lib/utils"

export function createQueryHooks<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>
) {
    function useFindMany<
        TableName extends keyof TSchema,
        TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
    >(
        table?: TableName | null | false | "",
        config?: TConfig,
        options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
    ) {
        const queryClient = useQueryClient()
        const { token, fetchEndpoint, appendTable } = useContext(NeonQueryContext)
        const neonDb = db as unknown as NeonHttpDatabase<TSchema>
        const authDb = neonDb.$withAuth(token || "") as unknown as PgDatabase<TQueryResult, TFullSchema, TSchema>

        const queryResult = useQuery<BuildQueryResult<TSchema, TSchema[TableName], TConfig>[]>({
            ...options,
            queryKey: table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : [],
            queryFn: table ? (async () => {
                if (fetchEndpoint && appendTable) {
                    neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}`
                }

                const results = await findMany(authDb, table, config)
                return results as BuildQueryResult<TSchema, TSchema[TableName], TConfig>[]
            }) : skipToken,
        })

        const { data, dataUpdatedAt } = queryResult

        // Seed the useFindFirst detail queries with the result data
        useEffect(() => {
            if (!data || !table) return

            data.forEach((result) => {
                const resultWithId = result as { id: unknown }
                if (!resultWithId.id) return
                queryClient.setQueryData([table, "detail", resultWithId.id], resultWithId, { updatedAt: dataUpdatedAt })
            })
        }, [data, queryClient, table, dataUpdatedAt])

        return queryResult
    }

    function useFindFirst<
        TableName extends keyof TSchema,
        TConfig extends DBQueryConfig<"one", true, TSchema, TSchema[TableName]>,
    >(
        table?: TableName | null | false | "",
        id?: TSchema[TableName]["columns"]["id"]["_"]["data"] | null,
        config?: TConfig | null,
        options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
    ) {
        const queryClient = useQueryClient()
        const { token, fetchEndpoint, appendTable } = useContext(NeonQueryContext)
        const neonDb = db as unknown as NeonHttpDatabase<TSchema>
        const authDb = neonDb.$withAuth(token || "") as unknown as PgDatabase<TQueryResult, TFullSchema, TSchema>

        const queryResult = useQuery<BuildQueryResult<TSchema, TSchema[TableName], TConfig>>({
            ...options,
            queryKey: [table, "detail", id, ...((!id && config) ? [serializeConfig(config)] : [])],
            queryFn: table ? (async () => {
                if (fetchEndpoint && appendTable) {
                    neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}` + (id ? `/${id}` : "")
                }

                const result = await findFirst(authDb, table, {
                    where: id ? eq(sql`id`, id) : undefined,
                    ...config
                })
                return result as BuildQueryResult<TSchema, TSchema[TableName], TConfig>
            }) : skipToken,
        })

        const { data, dataUpdatedAt } = queryResult

        // Update the useFindMany list queries with the result data, but only if they have the same number of columns
        useEffect(() => {
            if (!data || !table) return

            const listQueries = queryClient.getQueriesData<{ id: unknown }[]>({ queryKey: [table, "list"], exact: false })

            listQueries.forEach(([queryKey, existingData]) => {
                if (!existingData) return

                const updatedData = existingData.map((item) =>
                    (item.id == id && Object.keys(item).length == Object.keys(data).length) ? { ...item, ...data } : item
                )

                queryClient.setQueryData(queryKey, updatedData, { updatedAt: dataUpdatedAt })
            })
        }, [queryClient, id, data, table, dataUpdatedAt])

        return queryResult
    }

    return { useFindMany, useFindFirst }
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