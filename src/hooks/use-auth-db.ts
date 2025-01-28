import { TablesRelationalConfig } from "drizzle-orm"
import { NeonHttpDatabase } from "drizzle-orm/neon-http"
import { PgQueryResultHKT, PgDatabase } from "drizzle-orm/pg-core"
import { useContext } from "react"
import { NeonQueryContext } from "../lib/neon-query-provider"

export function useAuthDb<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
) {
    const { token } = useContext(NeonQueryContext)
    const neonDb = db as unknown as NeonHttpDatabase<TSchema>
    return neonDb.$withAuth(token || "") as unknown as PgDatabase<TQueryResult, TFullSchema, TSchema>
}