import type {
  ContainerOperatorEnv,
  ContainerOperatorInstance,
  ManagedContainerEnv,
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

export interface ServiceEnv extends ManagedContainerEnv<ContainerOperatorEnv> {
  API_SECRET: string
  SERVICE_NAME: string
  LOG_LEVEL: string
  MAX_CONNECTIONS: string
}

export interface WorkerApiEnv {
  SERVICE_OPERATOR: DurableObjectNamespace<ContainerOperatorInstance<ServiceEnv>>
}
