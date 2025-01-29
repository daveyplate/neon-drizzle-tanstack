"use client"

import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions } from "@tanstack/react-query"
import { createContext, ReactNode, useEffect } from "react"

export type RecordType = Record<string, unknown> & { id: unknown }
export type NeonQueryContextType = {
    token?: string | null,
    fetchEndpoint?: string,
    appendTableEndpoint?: boolean,
    mutateInvalidate?: boolean,
    optimisticMutate?: boolean,
    cachePropagation?: boolean,
    onMutate?: (table: string, operation: "delete" | "update" | "insert", records: RecordType[]) => void,
    queryOptions?: Omit<AnyUseQueryOptions, "queryFn" | "queryKey">
}

export const NeonQueryContext = createContext<NeonQueryContextType>({} as NeonQueryContextType)

export const NeonQueryProvider = (
    { children, fetchEndpoint, optimisticMutate = true, cachePropagation = true, ...props }: { children: ReactNode } & Omit<NeonQueryContextType, "setToken">
) => {
    useEffect(() => {
        if (!fetchEndpoint) return

        neonConfig.fetchEndpoint = fetchEndpoint
    }, [fetchEndpoint])

    return (
        <NeonQueryContext.Provider value={{ ...props, fetchEndpoint, optimisticMutate, cachePropagation }}>
            {children}
        </NeonQueryContext.Provider>
    )
}