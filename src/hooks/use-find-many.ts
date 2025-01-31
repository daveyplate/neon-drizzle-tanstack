import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext, useEffect, useState } from "react"

import { findMany } from "../lib/db-queries"
import { NeonQueryContext, NeonQueryContextType } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"

import { useAuthDb } from "./use-auth-db"
import { useDelete } from "./use-delete"
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
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn" | "refetchOnMount"> | null,
    context?: NeonQueryContextType | null
) {
    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => { setIsMounted(true) }, [])

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

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const queryResult = useQuery<TableType[]>({
        ...queryOptions,
        ...options,
        queryKey,
        queryFn: (isMounted && table) ? (async () => {
            if (fetchEndpoint && appendTableEndpoint) {
                neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}`
            }

            const records = await findMany(authDb, table, config)
            return records as TableType[]
        }) : skipToken,
    })

    const { data: records, dataUpdatedAt } = queryResult

    // Seed the useFindFirst detail queries with the result data
    useEffect(() => {
        if (!records || !table || !cachePropagation) return

        records.forEach((record) => {
            const recordWithId = record as { id: IDType }
            if (!recordWithId.id) return

            queryClient.setQueryData(
                [table, "detail", recordWithId.id],
                record, { updatedAt: dataUpdatedAt }
            )

            // TODO propogate each record to all other lists?
        })
    }, [records, queryClient, table, dataUpdatedAt, cachePropagation])

    const { insert } = useInsert(db, table, config)
    const { update } = useUpdate(db, table, config)
    const { delete: deleteRecord } = useDelete(db, table, config)

    return { ...queryResult, insert, update, delete: deleteRecord }
}