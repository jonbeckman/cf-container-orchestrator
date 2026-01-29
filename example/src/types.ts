import type {
  ContainerOperatorEnv,
  ContainerOperatorInstance,
} from "@jonbeckman/cf-container-orchestrator"

export interface ServiceConfig {
  serviceName: string
  logLevel: "debug" | "info" | "warn" | "error"
  maxConnections: number
}

// Default config that can be overridden
export const DEFAULT_SERVICE_CONFIG: ServiceConfig = {
  serviceName: "unknown",
  logLevel: "info",
  maxConnections: 100,
}

// export interface ServiceEnv {
//   // Bindings
//   // SERVICE_OPERATOR: DurableObjectNamespace<ContainerOperatorInstance<ServiceEnv>>
//   MANAGED_SERVICE: DurableObjectNamespace
//   // biome-ignore lint/suspicious/noExplicitAny: Standard operator binding
//   CONTAINER_OPERATOR: DurableObjectNamespace<ContainerOperatorInstance<ServiceEnv>>

//   // Environment variables
//   API_SECRET: string

//   // Dynamic Env Vars (injected via operator or wrangler)
//   SERVICE_NAME?: string
//   LOG_LEVEL?: string
//   MAX_CONNECTIONS?: string
// }

export interface ServiceEnv extends ContainerOperatorEnv {
  // Environment variables
  API_SECRET: string

  // Dynamic Env Vars (injected via operator or wrangler)
  SERVICE_NAME?: string
  LOG_LEVEL?: string
  MAX_CONNECTIONS?: string
}

export interface WorkerApiEnv {
  SERVICE_OPERATOR: DurableObjectNamespace<ContainerOperatorInstance<ServiceEnv>>
}
