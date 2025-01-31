import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle"
import { DocsLayout } from "fumadocs-ui/layouts/docs"
import type { ReactNode } from "react"

import { baseOptions } from "@/app/layout.config"
import { source } from "@/lib/source"

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <DocsLayout
            tree={source.pageTree}
            {...baseOptions}
            disableThemeSwitch={true}
            sidebar={{
                footer: (
                    <div className="md:-mt-8 w-32 ms-auto md:ms-0">
                        <ThemeToggle mode="light-dark-system" />
                    </div>
                )
            }}
        >
            {children}
        </DocsLayout>
    )
}
