import type { TablesRelationalConfig } from "drizzle-orm"
import { NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { useContext } from "react"

import { NeonQueryContext } from "../lib/neon-query-provider"

export function useAuthDb<
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig
>(schema?: TFullSchema) {

    const { token, db } = useContext(NeonQueryContext)
    const neonDb = db as unknown as NeonHttpDatabase

    return (token ? neonDb.$withAuth(token) : db) as PgDatabase<PgQueryResultHKT, TFullSchema, TSchema>
}