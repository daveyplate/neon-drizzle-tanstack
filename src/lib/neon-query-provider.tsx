"use client"

import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions } from "@tanstack/react-query"
import type { TablesRelationalConfig } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { ReactNode, createContext, useEffect } from "react"

export type RecordType = Record<string, unknown> & { id: unknown }
export type NeonQueryContextType = {
    db: PgDatabase<PgQueryResultHKT, Record<string, unknown>, TablesRelationalConfig>,
    token?: string | null,
    fetchEndpoint?: string,
    appendTableEndpoint?: boolean,
    mutateInvalidate?: boolean,
    optimisticMutate?: boolean,
    cachePropagation?: boolean,
    onMutate?: (
        table: string,
        operation: "delete" | "update" | "insert",
        records: RecordType[]
    ) => void,
    queryOptions?: Omit<AnyUseQueryOptions, "queryFn" | "queryKey">
}

export const NeonQueryContext = createContext<NeonQueryContextType>({} as unknown as NeonQueryContextType)

export const NeonQueryProvider = ({
    children, fetchEndpoint, optimisticMutate = true, cachePropagation = true, ...props
}: {
    children: ReactNode
} & Omit<NeonQueryContextType, "setToken">) => {
    useEffect(() => {
        if (!fetchEndpoint) return

        neonConfig.fetchEndpoint = fetchEndpoint
    }, [fetchEndpoint])

    return (
        <NeonQueryContext.Provider
            value={{ ...props, fetchEndpoint, optimisticMutate, cachePropagation }}
        >
            {children}
        </NeonQueryContext.Provider>
    )
}