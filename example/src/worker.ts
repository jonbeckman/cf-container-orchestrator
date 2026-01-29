import {
  ContainerNotFoundError,
  CrashLoopDetectedError,
} from "@jonbeckman/cf-container-orchestrator"
import { APIService } from "./container"
import { ServiceOperator } from "./operator"
import type { WorkerApiEnv } from "./types"

export { ServiceOperator, APIService }

export default {
  async fetch(request: Request, env: WorkerApiEnv): Promise<Response> {
    const url = new URL(request.url)
    const operatorId = env.SERVICE_OPERATOR.idFromName("global-operator")
    const operator = env.SERVICE_OPERATOR.get(operatorId)

    // Helper to handle operator errors
    const handleOperatorError = (error: unknown): Response => {
      if (error instanceof ContainerNotFoundError) {
        return Response.json({ error: error.message }, { status: 404 })
      }
      if (error instanceof CrashLoopDetectedError) {
        return Response.json({ error: error.message }, { status: 429 })
      }
      // Check if it's a ContainerError (has a message property)
      if (error && typeof error === "object" && "message" in error) {
        return Response.json({ error: String(error.message) }, { status: 500 })
      }
      return Response.json({ error: "Internal server error" }, { status: 500 })
    }

    // API Routes
    if (url.pathname === "/services") {
      try {
        // List all running services/containers
        const containers = await operator.listContainers()
        return Response.json(containers)
      } catch (error) {
        return handleOperatorError(error)
      }
    }

    if (url.pathname === "/reconcile" && request.method === "POST") {
      try {
        // Force a reconciliation run
        await operator.reconcile()
        return Response.json({ status: "reconciliation_triggered" })
      } catch (error) {
        return handleOperatorError(error)
      }
    }

    if (url.pathname.startsWith("/start/")) {
      try {
        // Start an ad-hoc service dynamically
        const name = url.pathname.split("/")[2]
        if (!name) {
          return Response.json({ error: "Container name required" }, { status: 400 })
        }

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
      } catch (error) {
        return handleOperatorError(error)
      }
    }

    if (url.pathname.startsWith("/stop/")) {
      try {
        // Stop a service
        const name = url.pathname.split("/")[2]
        if (!name) {
          return Response.json({ error: "Container name required" }, { status: 400 })
        }
        await operator.stopContainer(name)
        return Response.json({ status: "stopped", name })
      } catch (error) {
        return handleOperatorError(error)
      }
    }

    return new Response(
      "Service Orchestrator API\nGET /services\nPOST /reconcile\nGET /start/:name\nGET /stop/:name",
      { status: 200 },
    )
  },
}
