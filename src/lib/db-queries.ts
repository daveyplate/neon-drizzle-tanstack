import { TablesRelationalConfig, DBQueryConfig, BuildQueryResult, and, SQL, sql } from "drizzle-orm"
import { PgQueryResultHKT, PgDatabase, PgTable, PgUpdateSetSource, PgInsertValue } from "drizzle-orm/pg-core"
import { RelationalQueryBuilder } from "drizzle-orm/pg-core/query-builders/query"

export async function findMany<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"many", true, TSchema, TSchema[TableName]>
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table: TableName,
    config?: TConfig
) {
    const query = db.query as {
        [K in keyof TSchema]: RelationalQueryBuilder<TSchema, TSchema[K]>
    }

    return await query[table].findMany(config) as BuildQueryResult<TSchema, TSchema[TableName], TConfig>[]
}

export async function findFirst<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TableName extends keyof TSchema,
    TConfig extends DBQueryConfig<"one", true, TSchema, TSchema[TableName]>
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table: TableName,
    config?: TConfig
) {
    const query = db.query as {
        [K in keyof TSchema]: RelationalQueryBuilder<TSchema, TSchema[K]>
    }

    return await query[table].findFirst(config) as BuildQueryResult<TSchema, TSchema[TableName], TConfig>
}

export async function update<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TTable extends PgTable
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table: TTable,
    id: TTable["$inferSelect"]["id"] | null,
    values: PgUpdateSetSource<TTable>,
    where?: SQL
) {
    return await db.update(table).set(values).where(and(id ? sql`id = ${id}` : undefined, where)).returning()
}

export async function insert<
    TQueryResult extends PgQueryResultHKT,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
    TTable extends PgTable
>(
    db: PgDatabase<TQueryResult, TFullSchema, TSchema>,
    table: TTable,
    values: PgInsertValue<TTable>,
) {
    return await db.insert(table).values(values).returning()
}