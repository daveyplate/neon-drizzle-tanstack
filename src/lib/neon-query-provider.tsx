"use client"

import { neonConfig } from "@neondatabase/serverless"
import { AnyUseQueryOptions } from "@tanstack/react-query"
import { createContext, ReactNode, useContext, useEffect } from "react"

export type NeonQueryContextType = {
    token?: string | null,
    fetchEndpoint?: string,
    appendTable?: boolean,
    queryOptions?: Omit<AnyUseQueryOptions, "queryFn" | "queryKey">
}

export const NeonQueryContext = createContext<NeonQueryContextType>({} as NeonQueryContextType)

export const NeonQueryProvider = (
    { children, fetchEndpoint, ...props }: { children: ReactNode } & Omit<NeonQueryContextType, "setToken">
) => {
    useEffect(() => {
        if (!fetchEndpoint) return

        neonConfig.fetchEndpoint = fetchEndpoint
    }, [fetchEndpoint])

    return (
        <NeonQueryContext.Provider value={{ ...props, fetchEndpoint }}>
            {children}
        </NeonQueryContext.Provider>
    )
}

export const useToken = () => {
    const { token } = useContext(NeonQueryContext)
    return { token }
}