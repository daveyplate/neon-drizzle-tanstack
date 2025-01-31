import { neonConfig } from "@neondatabase/serverless"
import { Query, useMutation, useQueryClient } from "@tanstack/react-query"
import { BuildQueryResult, DBQueryConfig, type ExtractTablesWithRelations, SQL } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"
import { useContext } from "react"

import { updateQuery } from "../lib/db-queries"
import { NeonQueryContext, NeonQueryContextType, RecordType } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"

import { useAuthDb } from "./use-auth-db"

export function useUpdate<
    TFullSchema extends Record<string, unknown>,
    TSchema extends ExtractTablesWithRelations<TFullSchema>,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
    TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>,
    IDType = TSchema[TableName]["columns"]["id"]["_"]["data"]
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
        cachePropagation,
        onMutate
    } = { ...queryContext, ...context }

    const queryKey = table ? [table, "list", ...(config ? [serializeConfig(config)] : [])] : []

    const mutation = useMutation({
        mutationFn: ({ id, values, where }: {
            id?: IDType | null,
            values?: Partial<Omit<TableType, "id" | "createdAt">>,
            where?: SQL
        }) => {
            if (fetchEndpoint && appendTableEndpoint) {
                neonConfig.fetchEndpoint = fetchEndpoint + `/${table as string}` + (id ? `/${id}/update` : "/update")
            }

            return updateQuery(db, pgTable, id, { ...values }, where)
        },
        onMutate: async ({ values, id }) => {
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

                    queryClient.setQueryData(queryKey, previousData.map((data) => {
                        if (data.id == id) {
                            return { ...data, ...values }
                        }

                        return data
                    }))
                } else if (queryKey[1] == "detail") {
                    const previousData = query.state.data as TableType
                    if (!previousData) return

                    queryClient.setQueryData(queryKey, { ...previousData, ...values }, { updatedAt: Date.now() })
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
                    { queryKey: [table, "update"] } as unknown as Query<unknown, unknown, unknown, readonly unknown[]>
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

                            queryClient.setQueryData(queryKey, previousData.map((data) => {
                                if (data.id == record.id) {
                                    return record
                                }

                                return data
                            }))
                        } else if (queryKey[1] == "detail") {
                            const previousData = query.state.data as TableType

                            if (!previousData) return

                            queryClient.setQueryData(queryKey, record, { updatedAt: Date.now() })
                        }
                    })
                })
            }

            if (mutateInvalidate) {
                await queryClient.invalidateQueries({ queryKey: [table] })
            }
        },
        mutationKey: [table, "update"]
    })

    const { variables, mutate } = mutation

    const update = (id?: IDType | null, values?: Partial<Omit<TableType, "id" | "createdAt">>, where?: SQL) => {
        mutate({ id, values, where })
    }

    return { ...mutation, variables: variables as TableType, update }
}