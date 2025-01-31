import type { DBQueryConfig, TablesRelationalConfig } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import type { NeonQueryContextType } from "../lib/neon-query-provider"

import { useDelete } from "./use-delete"
import { useInsert } from "./use-insert"
import { useUpdate } from "./use-update"

export function useMutate<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    context?: NeonQueryContextType | null
) {
    const { update } = useUpdate(db, table, config, context)
    const { delete: deleteRecord } = useDelete(db, table, config, context)
    const { insert } = useInsert(db, table, config, context)

    return { insert, update, delete: deleteRecord }
}