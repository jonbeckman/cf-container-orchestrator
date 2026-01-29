import { APIService } from "./container"
import { ServiceOperator } from "./operator"
import type { WorkerApiEnv } from "./types"

export { ServiceOperator, APIService }

export default {
  async fetch(request: Request, env: WorkerApiEnv): Promise<Response> {
    const url = new URL(request.url)
    const operatorId = env.SERVICE_OPERATOR.idFromName("global-operator")
    const operator = env.SERVICE_OPERATOR.get(operatorId)

    // API Routes
    if (url.pathname === "/services") {
      // List all running services/containers
      const containers = await operator.listContainers()
      return Response.json(containers)
    }

    if (url.pathname === "/reconcile" && request.method === "POST") {
      // Force a reconciliation run
      await operator.reconcile()
      return Response.json({ status: "reconciliation_triggered" })
    }

    if (url.pathname.startsWith("/start/")) {
      // Start an ad-hoc service dynamically
      const name = url.pathname.split("/")[2]

      let customConfig = {}
      try {
        if (request.headers.get("content-type")?.includes("application/json")) {
          customConfig = await request.json()
        }
      } catch (e) {
        console.warn("Failed to parse request body", e)
      }

      await operator.startContainer({
        name,
        config: {
          serviceName: name,
          mode: "active",
          logLevel: "info",
          ...customConfig,
        },
      })
      return Response.json({ status: "started", name })
    }

    if (url.pathname.startsWith("/stop/")) {
      // Stop a service
      const name = url.pathname.split("/")[2]
      await operator.stopContainer(name)
      return Response.json({ status: "stopped", name })
    }

    return new Response(
      "Service Orchestrator API\nGET /services\nPOST /reconcile\nGET /start/:name\nGET /stop/:name",
      { status: 200 },
    )
  },
}
