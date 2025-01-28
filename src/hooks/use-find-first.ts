import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, useQueryClient, useQuery, skipToken } from "@tanstack/react-query"
import { DBQueryConfig, BuildQueryResult, eq, sql, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext, useEffect } from "react"
import { findFirst } from "../lib/db-queries"
import { NeonQueryContext } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"
import { useAuthDb } from "./use-auth-db"

export function useFindFirst<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"one", true, TSchema, TSchema[TableName]>,
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    id?: TSchema[TableName]["columns"]["id"]["_"]["data"] | null,
    config?: TConfig | null,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
) {
    const { fetchEndpoint, appendTable } = useContext(NeonQueryContext)
    const queryClient = useQueryClient()
    const authDb = useAuthDb(db)

    const queryKey = table ? [table, "detail", id, ...((!id && config) ? [serializeConfig(config)] : [])] : []

    const queryResult = useQuery<BuildQueryResult<TSchema, TSchema[TableName], TConfig>>({
        ...options,
        queryKey,
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

    const { data: result, dataUpdatedAt } = queryResult

    // Update the useFindMany list queries with the result data, but only if they have the same number of columns
    useEffect(() => {
        if (!result || !table) return

        const listQueries = queryClient.getQueriesData<{ id: unknown }[]>({ queryKey: [table, "list"], exact: false })

        listQueries.forEach(([queryKey, existingData]) => {
            if (!existingData) return

            const updatedData = existingData.map((item) =>
                (item.id == id && Object.keys(item).length == Object.keys(result).length) ? { ...item, ...result } : item
            )

            queryClient.setQueryData(queryKey, updatedData, { updatedAt: dataUpdatedAt })
        })
    }, [queryClient, id, result, table, dataUpdatedAt])

    return queryResult
}