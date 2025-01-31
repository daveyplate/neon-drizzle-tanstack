import { neonConfig } from "@neondatabase/serverless"
import { Query, useMutation, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, type ExtractTablesWithRelations } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { useContext } from "react"

import { insertQuery } from "../lib/db-queries"
import { NeonQueryContext, NeonQueryContextType, RecordType } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"

import { useAuthDb } from "./use-auth-db"

export function useInsert<
    TFullSchema extends Record<string, unknown>,
    TSchema extends ExtractTablesWithRelations<TFullSchema>,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>
>(
    schema: TFullSchema,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    context?: NeonQueryContextType | null
) {
    const db = useAuthDb()
    const pgTable = db._.fullSchema[table as string] as PgTable
    const queryClient = useQueryClient()
    const queryContext = useContext(NeonQueryContext)
    const {
        appendTableEndpoint,
        fetchEndpoint,
        mutateInvalidate,
        optimisticMutate,
        onMutate
    } = { ...queryContext, ...context }

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const mutation = useMutation({
        mutationFn: (values: Partial<TableType>) => {
            if (fetchEndpoint && appendTableEndpoint) {
                neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}/insert`
            }

            return insertQuery(db, pgTable, values)
        },
        onMutate: async (values) => {
            if (!optimisticMutate) return

            // Cancel any outgoing refetches
            // (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: [table] })

            // Snapshot the previous query state
            const previousQueryState = queryClient.getQueryState(queryKey)
            const previousData = previousQueryState?.data as TableType[]

            // Optimistically update to the new value
            if (previousData) {
                queryClient.setQueryData(queryKey, [...previousData, values])
            }

            // Return a context object with the snapshotted query state
            return { previousQueryState }
        },
        onError: (error, values, context) => {
            if (error) {
                console.error(error)
                queryClient.getQueryCache().config.onError?.(error, { queryKey: [table, "insert"] } as unknown as Query<unknown, unknown, unknown, readonly unknown[]>)
            }

            if (!optimisticMutate) return

            const previousData = context?.previousQueryState?.data as TableType[]
            if (!previousData) return

            queryClient.setQueryData(queryKey, previousData, { updatedAt: context!.previousQueryState!.dataUpdatedAt })
        },
        onSettled: async (records, error, values, context) => {
            onMutate?.(table as string, "delete", records as RecordType[])

            if (optimisticMutate) {
                const previousData = context?.previousQueryState?.data as TableType[]

                if (previousData) {
                    queryClient.setQueryData(queryKey, [...previousData, ...(records as TableType[])])
                }
            }

            if (!mutateInvalidate) return

            await queryClient.invalidateQueries({ queryKey: [table] })
        },
        mutationKey: [table, "insert"]
    })

    const { variables, mutate } = mutation

    return { ...mutation, variables: variables as TableType, insert: mutate }
}