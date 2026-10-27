import { describe, expect, it, vi } from "vitest"

import {
  asScoutProblem,
  normalizeScoutBrief,
  normalizeScoutPage,
  parseScoutEventStream,
  scoutApi,
  scoutProblemMessage,
} from "@/lib/scout-api"

describe("scout api helpers", () => {
  it("maps retryable backend problems to a user-facing message", () => {
    const problem = asScoutProblem({
      status: 503,
      code: "source_unavailable",
      message: "Zotero is temporarily unavailable",
      retryable: true,
      requestId: "req-1",
    })

    expect(scoutProblemMessage(problem)).toContain("外部来源暂时不可用")
    expect(scoutProblemMessage(problem)).toContain("可重试")
  })

  it("normalizes bare arrays and paged responses", () => {
    expect(normalizeScoutPage<string>(["a", "b"])).toEqual({
      items: ["a", "b"],
      nextCursor: null,
    })
    expect(normalizeScoutPage<string>({ items: ["a"], meta: { next_cursor: "next" } })).toEqual({
      items: ["a"],
      nextCursor: "next",
    })
  })
})

describe("scout api bearer auth", () => {
  it("sends the Lab Nexus bearer token and same-origin credentials", async () => {
    localStorage.setItem("ln_token", "ln-access-token")
    const calls: { url: string; init: RequestInit }[] = []
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await scoutApi.listConnections()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const headers = new Headers(calls[0].init.headers)
    expect(headers.get("Authorization")).toBe("Bearer ln-access-token")
    expect(calls[0].init.credentials).toBe("same-origin")
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("refreshes once on 401 then replays the request with the new token", async () => {
    localStorage.setItem("ln_token", "stale-token")
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/auth/refresh") {
        return new Response(JSON.stringify({ access_token: "fresh-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      const auth = new Headers(init.headers).get("Authorization")
      if (auth === "Bearer stale-token") {
        return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await scoutApi.listConnections()

    // one 401 attempt, one refresh, one replay
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh")
    const replayHeaders = new Headers(fetchMock.mock.calls[2][1].headers)
    expect(replayHeaders.get("Authorization")).toBe("Bearer fresh-token")
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("surfaces an unauthorized problem when refresh fails", async () => {
    localStorage.setItem("ln_token", "stale-token")
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/auth/refresh") {
        return new Response("", { status: 401 })
      }
      return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(scoutApi.listConnections()).rejects.toMatchObject({
      code: "unauthorized",
      status: 401,
    })
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("refreshes once before replaying an event stream request", async () => {
    localStorage.setItem("ln_token", "stale-token")
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/auth/refresh") {
        return new Response(JSON.stringify({ access_token: "fresh-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      const auth = new Headers(init.headers).get("Authorization")
      if (auth === "Bearer stale-token") {
        return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response(
        "id: 1\nevent: phase_changed\ndata: {\"phase\":\"planning\"}\n\n",
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const events = await scoutApi.sessionEvents("session-1")

    expect(events).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const replayHeaders = new Headers(fetchMock.mock.calls[2][1].headers)
    expect(replayHeaders.get("Authorization")).toBe("Bearer fresh-token")
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it("refreshes once before replaying a brief export request", async () => {
    localStorage.setItem("ln_token", "stale-token")
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/auth/refresh") {
        return new Response(JSON.stringify({ access_token: "fresh-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }
      const auth = new Headers(init.headers).get("Authorization")
      if (auth === "Bearer stale-token") {
        return new Response(JSON.stringify({ error: { code: "unauthorized", message: "expired" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      }
      return new Response("brief-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const blob = await scoutApi.exportBrief("brief-1", "json")

    expect(await blob.text()).toBe("brief-json")
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const replayHeaders = new Headers(fetchMock.mock.calls[2][1].headers)
    expect(replayHeaders.get("Authorization")).toBe("Bearer fresh-token")
    vi.unstubAllGlobals()
    localStorage.clear()
  })
})

describe("scout event stream parsing", () => {
  it("parses id/event/data blocks including the backend keep-alive comment", () => {
    const payload = [
      ": connected",
      "",
      "id: 1\nevent: session_accepted\ndata: {\"mode\":\"my_library\",\"question\":\"q\"}",
      "",
      "id: 2\nevent: phase_changed\ndata: {\"phase\":\"planning\"}",
      "",
    ].join("\n")

    const events = parseScoutEventStream(payload)

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ id: "1", seq: 1, type: "session_accepted" })
    expect(events[1].data).toEqual({ phase: "planning" })
  })

  it("keeps malformed data as an empty payload instead of throwing", () => {
    const events = parseScoutEventStream("id: 5\nevent: brief_ready\ndata: not-json\n\n")

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ id: "5", seq: 5, type: "brief_ready" })
    expect(events[0].data).toEqual({})
  })

  it("skips blocks without an event name or payload", () => {
    expect(parseScoutEventStream("data: {}\n\n")).toEqual([])
    expect(parseScoutEventStream("event: heartbeat\n\n")).toEqual([])
    expect(parseScoutEventStream("")).toEqual([])
  })
})

describe("scout brief normalization", () => {
  it("folds the abstain response's null arrays into empty arrays", () => {
    const brief = normalizeScoutBrief({
      id: "brief-1",
      summary: "Insufficient scientific evidence in the current scope to answer this question.",
      findings: null,
      citations: null,
      gaps: null,
      open_questions: null,
      method_timeline: null,
      chronology: null,
      source_status: null,
    })

    expect(brief.findings).toEqual([])
    expect(brief.citations).toEqual([])
    expect(brief.gaps).toEqual([])
    expect(brief.open_questions).toEqual([])
    expect(brief.source_status).toEqual([])
  })

  it("keeps populated arrays untouched", () => {
    const brief = normalizeScoutBrief({ findings: [{ claim_id: "c1" }], citations: [{ id: "e1" }] })

    expect(brief.findings).toHaveLength(1)
    expect(brief.citations).toHaveLength(1)
  })
})

describe("scout project creation contract", () => {
  it("posts flat scope fields that the backend handler actually binds", async () => {
    let body: unknown = null
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body))
      return new Response(JSON.stringify({ id: "project-1" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    await scoutApi.createProject({
      name: "云存储完整性审计",
      default_mode: "my_library",
      scope_mode: "selected_collections",
      collection_ids: ["col-1"],
    })

    expect(body).toMatchObject({
      name: "云存储完整性审计",
      default_mode: "my_library",
      scope_mode: "selected_collections",
      collection_ids: ["col-1"],
    })
    expect(body).not.toHaveProperty("scope")
    vi.unstubAllGlobals()
    localStorage.clear()
  })
})
