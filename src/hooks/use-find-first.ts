import { neonConfig } from "@neondatabase/serverless"
import {
    AnyUseQueryOptions,
    skipToken,
    useQuery,
    useQueryClient
} from "@tanstack/react-query"
import {
    BuildQueryResult,
    DBQueryConfig,
    TablesRelationalConfig,
    eq,
    sql
} from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext, useEffect } from "react"

import { findFirst } from "../lib/db-queries"
import {
    NeonQueryContext,
    NeonQueryContextType
} from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"

import { useAuthDb } from "./use-auth-db"
import { useDelete } from "./use-delete"
import { useUpdate } from "./use-update"

export function useFindFirst<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"one", true, TSchema, TSchema[TableName]>,
    IDType = TSchema[TableName]["columns"]["id"]["_"]["data"]
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    id?: IDType | null,
    config?: TConfig | null,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null,
    context?: NeonQueryContextType | null
) {
    type TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>

    const queryContext = useContext(NeonQueryContext)
    const queryClient = useQueryClient()
    const authDb = useAuthDb(db)

    const {
        fetchEndpoint,
        appendTableEndpoint,
        cachePropagation,
        queryOptions
    } = { ...queryContext, ...context }

    const queryKey = table ? [table, "detail", id, ...((!id && config) ? [serializeConfig(config)] : [])] : []

    const queryResult = useQuery<TableType>({
        ...queryOptions,
        ...options,
        queryKey,
        queryFn: table ? (async () => {
            if (fetchEndpoint && appendTableEndpoint) {
                neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}` + (id ? `/${id}` : "")
            }

            const record = await findFirst(authDb, table, {
                where: id ? eq(sql`id`, id) : undefined,
                ...config
            })

            return record as TableType
        }) : skipToken,
    })

    const { data: record, dataUpdatedAt } = queryResult

    // Update the useFindMany list queries with the result data, but only if they have the same number of columns
    useEffect(() => {
        if (!record || !table || !cachePropagation) return

        const listQueries = queryClient.getQueriesData<{ id: IDType }[]>({
            queryKey: [table, "list"],
            exact: false
        })

        listQueries.forEach(([queryKey, existingData]) => {
            if (!existingData) return

            const updatedData = existingData.map((item) =>
                (item.id == id && Object.keys(item).length == Object.keys(record).length) ? record : item)

            queryClient.setQueryData(queryKey, updatedData)
        })
    }, [queryClient, id, record, table, dataUpdatedAt, cachePropagation])

    const { update: updateRecord } = useUpdate(db, table, config)
    const { delete: deleteRecord } = useDelete(db, table, config)

    const update = (values: Partial<TableType>) => updateRecord(id, values)

    return { ...queryResult, update, delete: () => deleteRecord(id) }
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