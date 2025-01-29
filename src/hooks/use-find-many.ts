import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions, useQueryClient, useQuery, skipToken, useMutation } from "@tanstack/react-query"
import { DBQueryConfig, BuildQueryResult, TablesRelationalConfig } from "drizzle-orm"
import { PgDatabase, PgQueryResultHKT, PgTable } from "drizzle-orm/pg-core"
import { useContext, useEffect } from "react"
import { findMany, updateQuery } from "../lib/db-queries"
import { NeonQueryContext } from "../lib/neon-query-provider"
import { serializeConfig } from "../lib/utils"
import { useAuthDb } from "./use-auth-db"
import { useInsert } from "./use-insert"

export function useFindMany<
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
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
) {
    const pgTable = db._.fullSchema[table as string] as PgTable
    const { fetchEndpoint, appendTableEndpoint, mutateInvalidate, cachePropagation } = useContext(NeonQueryContext)
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

    const { mutate: insert } = useInsert(db, table, config)

    const { mutate: updateMutate } = useMutation({
        mutationFn: (
            { id, values }: {
                id: IDType,
                values: Partial<TableType>
            }
        ) => {
            return updateQuery(authDb, pgTable, id, values)
        },
        onMutate: async ({ id, values }) => {
            // Cancel any outgoing refetches
            // (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey })

            // Snapshot the previous value
            const previousData = queryClient.getQueryData(queryKey)

            // Optimistically Update the entry where we have this ID
            queryClient.setQueryData(queryKey, (old: { id: unknown }[]) => {
                return old.map((result) => {
                    if (result.id == id) {
                        return { ...result, ...values }
                    }

                    return result
                })
            })

            // Return a context object with the snapshotted value
            return { previousData }
        },
        // If the mutation fails,
        // use the context returned from onMutate to roll back
        onError: (err, variables, context) => {
            queryClient.setQueryData(queryKey, context?.previousData)
        },
        // Always refetch after error or success:
        onSettled: async () => {
            if (mutateInvalidate) {
                await queryClient.invalidateQueries({ queryKey: [table] })
            }
        },
    })

    const update = async (id: IDType, values: Partial<TableType>) => {
        updateMutate({ id, values })
    }

    return { ...queryResult, insert, update }
}