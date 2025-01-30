import {
    DBQueryConfig,
    SQL,
    TableRelationalConfig,
    TablesRelationalConfig
} from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"

export function serializeConfig<
    TMode extends "one" | "many",
    TSchema extends TablesRelationalConfig,
    TTableConfig extends TableRelationalConfig
>(config: DBQueryConfig<TMode, true, TSchema, TTableConfig>): string {

    function replacer(key: string, value: unknown): unknown {
        if (typeof value === "function") {
            // Convert the function to its string representation
            const funcStr = value.toString()
            // Match the content of the return statement
            const match = funcStr.match(/return\s+([^;}]*)/)

            // Return the extracted part or entire function if no match found
            return match ? match[1].replace(/\s+/g, " ").trim() : funcStr
        }

        if (value instanceof SQL) {
            // Convert SQL expressions to their string representation
            const query = value.toQuery({
                casing: new CasingCache,
                inlineParams: true,

                escapeName: function (name: string): string {
                    return name

                    // throw new Error("Function not implemented.")
                },
                escapeParam: function (num: number, value: unknown): string {
                    return `${num}-${value}`

                    // throw new Error("Function not implemented.")
                },
                escapeString: function (str: string): string {
                    return str
                    // throw new Error("Function not implemented.")
                }
            })

            return query.sql
        }

        return value
    }

    return JSON.stringify(config, replacer, 2)
}
