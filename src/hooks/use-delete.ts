import { useContext } from "react"
import { Query, useMutation, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, SQL, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT, PgTable } from "drizzle-orm/pg-core"

import { NeonQueryContext, NeonQueryContextType, RecordType } from "../lib/neon-query-provider"
import { deleteQuery } from "../lib/db-queries"
import { useAuthDb } from "./use-auth-db"
import { serializeConfig } from "../lib/utils"

export function useDelete<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>,
    IDType = TSchema[TableName]["columns"]["id"]["_"]["data"]
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    context?: NeonQueryContextType | null
) {
    const pgTable = db._.fullSchema[table as string] as PgTable
    const queryClient = useQueryClient()
    const queryContext = useContext(NeonQueryContext)
    const { mutateInvalidate, optimisticMutate, cachePropagation, onMutate } = { ...queryContext, ...context }
    const authDb = useAuthDb(db)

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const mutation = useMutation({
        mutationFn: ({ id, where }: {
            id?: IDType,
            where?: SQL
        }) => deleteQuery(authDb, pgTable, id, where),
        onMutate: async ({ id }) => {
            if (!optimisticMutate || !id) return

            // Cancel any outgoing refetches
            // (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: [table] })

            // Snapshot the previous query states
            const previousQueries: Query[] = []
            const queries = cachePropagation ?
                queryClient.getQueryCache().findAll({ queryKey: [table], exact: false })
                : queryClient.getQueryCache().findAll({ queryKey, exact: true })

            queries.forEach((query) => {
                const queryKey = query.queryKey as string[]
                if (queryKey.length <= 1) return

                if (queryKey[1] == "list") {
                    const previousData = query.state.data as { id: IDType }[]
                    if (!previousData?.find((data) => data.id == id)) return

                    queryClient.setQueryData(queryKey, previousData.filter((data) => data.id != id))
                } else if (queryKey[1] == "detail") {
                    const previousData = query.state.data
                    if (!previousData) return

                    queryClient.setQueryData(queryKey, null, { updatedAt: Date.now() })
                } else {
                    return
                }

                previousQueries.push(query)
            })

            // Return a context object with the snapshotted query state
            return { previousQueries }
        },
        onError: (error, { id }, context) => {
            if (error) {
                console.error(error)
                queryClient.getQueryCache().config.onError?.(
                    error,
                    { queryKey: [table, "delete"] } as unknown as Query<unknown, unknown, unknown, readonly unknown[]>
                )
            }

            if (!optimisticMutate || !id) return

            const previousQueries = context!.previousQueries
            previousQueries.forEach((query) => {
                const previousData = query.state.data
                if (!previousData) return

                queryClient.setQueryData(query.queryKey, previousData, { updatedAt: query.state.dataUpdatedAt })
            })
        },
        onSettled: async (records, error, variables, context) => {
            onMutate?.(table as string, "delete", records as RecordType[])
            if (optimisticMutate) {
                const queries = cachePropagation ?
                    queryClient.getQueryCache().findAll({ queryKey: [table], exact: false })
                    : queryClient.getQueryCache().findAll({ queryKey, exact: true })

                records?.forEach((record) => {
                    queries.forEach((query) => {
                        const queryKey = query.queryKey as string[]
                        if (queryKey.length <= 1) return

                        if (queryKey[1] == "list") {
                            const previousData = query.state.data as { id: IDType }[]
                            if (!previousData?.find((data) => data.id == record.id)) return

                            queryClient.setQueryData(queryKey, previousData.filter((data) => data.id != record.id))
                        }
                    })
                })
            }

            if (mutateInvalidate) {
                await queryClient.invalidateQueries({ queryKey: [table] })
            }
        },
        mutationKey: [table, "delete"]
    })

    const { variables, mutate } = mutation

    const deleteRecord = (id?: IDType, where?: SQL) => {
        mutate({ id, where })
    }

    return { ...mutation, variables: variables as TableType, delete: deleteRecord }
}