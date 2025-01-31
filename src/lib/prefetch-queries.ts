import { AnyUseQueryOptions, type QueryClient } from "@tanstack/react-query"
import { type BuildQueryResult, type DBQueryConfig, type TablesRelationalConfig } from "drizzle-orm"
import { type PgDatabase, type PgQueryResultHKT } from "drizzle-orm/pg-core"

import { findMany } from "./db-queries"
import { serializeConfig } from "./utils"

export async function prefetchFindMany<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>,
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    queryClient: QueryClient,
    table: TableName,
    config?: TConfig | null,
    options?: Omit<AnyUseQueryOptions, "queryKey" | "queryFn"> | null
) {
    type TableType = BuildQueryResult<TSchema, TSchema[TableName], TConfig>

    if (process.env.NODE_ENV === "development") await new Promise((resolve) => setTimeout(resolve, 200))

    const queryKey = [table, "list", ...(config ? [serializeConfig(config)] : [])]
    const results = await findMany(db, table, config)

    queryClient.prefetchQuery<TableType[]>({
        ...options,
        queryKey,
        queryFn: async () => {
            return results as TableType[]
        }
    })

    return results as TableType[]
}