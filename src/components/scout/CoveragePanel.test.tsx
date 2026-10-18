import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CoveragePanel } from "@/components/scout/CoveragePanel"
import type { ScoutCoverage } from "@/lib/scout-types"

const coverage: ScoutCoverage = {
  visible_items: 159,
  indexed_documents: 152,
  personal_fulltext: 149,
  structured_abstract: 3,
  metadata_only: 7,
  failed: 0,
  last_success_at: "2026-10-17T00:55:22+08:00",
  local_only_warning: true,
}

describe("Scout CoveragePanel", () => {
  it("renders all evidence coverage buckets", () => {
    render(<CoveragePanel coverage={coverage} />)

    expect(screen.getByTestId("coverage-indexed-documents").textContent).toContain("152")
    expect(screen.getByTestId("coverage-personal-fulltext").textContent).toContain("149")
    expect(screen.getByTestId("coverage-structured-abstract").textContent).toContain("3")
    expect(screen.getByTestId("coverage-metadata-only").textContent).toContain("7")
  })

  it("marks metadata-only items as unsuitable as evidence", () => {
    render(<CoveragePanel coverage={coverage} />)

    expect(screen.getByText(/仅元数据 · 不作为结论证据/)).toBeTruthy()
  })

  it("surfaces the local-only limitation", () => {
    render(<CoveragePanel coverage={coverage} />)

    expect(screen.getByRole("note").textContent).toContain("本地-only")
  })
})
