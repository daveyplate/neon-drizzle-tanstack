import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, useQueryClient, useQuery, skipToken } from "@tanstack/react-query"
import { DBQueryConfig, BuildQueryResult, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext, useEffect } from "react"
import { findMany } from "../lib/db-queries"
import { NeonQueryContext, NeonQueryContextType } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"
import { useAuthDb } from "./use-auth-db"
import { useInsert } from "./use-insert"
import { useUpdate } from "./use-update"

export function useFindMany<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    IDType = TSchema[TableName]["columns"]["id"]["_"]["data"]
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null,
    context?: NeonQueryContextType | null
) {
    type TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>

    const queryContext = useContext(NeonQueryContext)
    const { fetchEndpoint, appendTableEndpoint, cachePropagation } = { ...queryContext, ...context }
    const queryClient = useQueryClient()
    const authDb = useAuthDb(db)

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const queryResult = useQuery<TableType[]>({
        ...options,
        queryKey,
        queryFn: table ? (async () => {
            if (fetchEndpoint && appendTableEndpoint) {
                neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}`
            }

            const results = await findMany(authDb, table, config)
            return results as TableType[]
        }) : skipToken,
    })

    const { data: results, dataUpdatedAt } = queryResult

    // Seed the useFindFirst detail queries with the result data
    useEffect(() => {
        if (!results || !table || !cachePropagation) return

        results.forEach((result) => {
            const resultWithId = result as { id: unknown }
            if (!resultWithId.id) return

            queryClient.setQueryData([table, "detail", resultWithId.id], resultWithId, { updatedAt: dataUpdatedAt })

            // TODO propogate each result to all other lists?
        })
    }, [results, queryClient, table, dataUpdatedAt, cachePropagation])

    const { insert } = useInsert(db, table, config)
    const { update } = useUpdate(db, table, config)

    return { ...queryResult, insert, update }
}