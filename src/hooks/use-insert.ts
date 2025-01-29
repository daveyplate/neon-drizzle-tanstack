import { Query, useMutation, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT, PgTable } from "drizzle-orm/pg-core"
import { useAuthDb } from "./use-auth-db"
import { useContext } from "react"
import { NeonQueryContext } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"
import { insertQuery } from "../lib/db-queries"

export function useInsert<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>,
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    config?: TConfig | null,
) {
    const pgTable = db._.fullSchema[table as string] as PgTable

    const queryClient = useQueryClient()
    const { mutateInvalidate, optimisticMutate } = useContext(NeonQueryContext)
    const authDb = useAuthDb(db)

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const mutation = useMutation({
        mutationFn: (variables: Partial<TableType>) => insertQuery(authDb, pgTable, variables),
        onMutate: async (variables) => {
            if (!optimisticMutate) return

            // Cancel any outgoing refetches
            // (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey })

            // Snapshot the previous query state
            const previousQueryState = queryClient.getQueryState(queryKey)
            const previousData = previousQueryState?.data as TableType[]

            // Optimistically update to the new value
            if (previousData) {
                queryClient.setQueryData(queryKey, [...previousData, variables], { updatedAt: Date.now() })
            }

            // Return a context object with the snapshotted query state
            return { previousQueryState }
        },
        onError: (error, variables, context) => {
            if (error) {
                console.error(error)
                queryClient.getQueryCache().config.onError?.(error, { queryKey: [table, "insert"] } as unknown as Query<unknown, unknown, unknown, readonly unknown[]>)
            }

            if (!optimisticMutate) return

            const previousData = context?.previousQueryState?.data as TableType[]

            if (previousData) {
                queryClient.setQueryData(queryKey, previousData, { updatedAt: context!.previousQueryState!.dataUpdatedAt })
            }
        },
        onSettled: async (results, error, variables, context) => {
            if (optimisticMutate) {
                const previousData = context?.previousQueryState?.data as TableType[]
                if (previousData) {
                    queryClient.setQueryData(queryKey, [...previousData, ...(results as TableType[])], { updatedAt: Date.now() })
                }
            }

            if (mutateInvalidate) {
                await queryClient.invalidateQueries({ queryKey: [table] })
            }
        },
        mutationKey: [table, "insert"]
    })

    const { variables } = mutation
    return { ...mutation, variables: variables as TableType }
}