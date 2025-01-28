import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, useQueryClient, useQuery, skipToken } from "@tanstack/react-query"
import { DBQueryConfig, BuildQueryResult, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext, useEffect } from "react"
import { findMany } from "../lib/db-queries"
import { NeonQueryContext } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"
import { useAuthDb } from "./use-auth-db"

export function useFindMany<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    config?: TConfig,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
) {
    const { fetchEndpoint, appendTable } = useContext(NeonQueryContext)
    const queryClient = useQueryClient()
    const authDb = useAuthDb(db)

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const queryResult = useQuery<BuildQueryResult<TSchema, TSchema[TableName], TConfig>[]>({
        ...options,
        queryKey,
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