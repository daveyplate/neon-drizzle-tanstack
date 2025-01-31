import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, type ExtractTablesWithRelations } from "drizzle-orm"
import { useContext, useEffect, useState } from "react"

import { findMany } from "../lib/db-queries"
import { NeonQueryContext, NeonQueryContextType } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"

import { useAuthDb } from "./use-auth-db"
import { useDelete } from "./use-delete"
import { useInsert } from "./use-insert"
import { useUpdate } from "./use-update"

export function useFindMany<
    TFullSchema extends Record<string, unknown>,
    TSchema extends ExtractTablesWithRelations<TFullSchema>,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    TableType extends BuildQueryResult<TSchema, TSchema[TableName], TConfig>,
    IDType extends TSchema[TableName]["columns"]["id"]["_"]["data"]
>(
    schema: TFullSchema,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn" | "refetchOnMount"> | null,
    context?: NeonQueryContextType | null
) {
    const [isMounted, setIsMounted] = useState(false)
    useEffect(() => { setIsMounted(true) }, [])

    const queryContext = useContext(NeonQueryContext)
    const queryClient = useQueryClient()
    const db = useAuthDb<TFullSchema, TSchema>()

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

            const records = await findMany(db, table, config)
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

            // TODO propagate each record to all other lists?
        })
    }, [records, queryClient, table, dataUpdatedAt, cachePropagation])

    const { insert } = useInsert<TFullSchema, TSchema, TableName, TConfig>(schema, table, config)
    const { update } = useUpdate<TFullSchema, TSchema, TableName, TConfig>(schema, table, config)
    const { delete: deleteRecord } = useDelete<TFullSchema, TSchema, TableName, TConfig>(schema, table, config)

    return { ...queryResult, insert, update, delete: deleteRecord }
}