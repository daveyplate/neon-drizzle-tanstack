import type { DBQueryConfig, ExtractTablesWithRelations } from "drizzle-orm"

import type { NeonQueryContextType } from "../lib/neon-query-provider"

import { useDelete } from "./use-delete"
import { useInsert } from "./use-insert"
import { useUpdate } from "./use-update"

export function useMutate<
    TFullSchema extends Record<string, unknown>,
    TableName extends keyof ExtractTablesWithRelations<TFullSchema>,
    TConfig extends DBQueryConfig<"many", true, ExtractTablesWithRelations<TFullSchema>, ExtractTablesWithRelations<TFullSchema>[TableName]>
>(
    schema: TFullSchema,
    table?: TableName | null | false | "",
    config?: TConfig | null,
    context?: NeonQueryContextType | null
) {
    const { update } = useUpdate(schema, table, config, context)
    const { delete: deleteRecord } = useDelete(schema, table, config, context)
    const { insert } = useInsert(schema, table, config, context)

    return { insert, update, delete: deleteRecord }
}