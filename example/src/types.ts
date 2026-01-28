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

export interface ServiceEnv {
  // Bindings
  SERVICE_OPERATOR: DurableObjectNamespace
  MANAGED_SERVICE: DurableObjectNamespace
  
  // Environment variables
  API_SECRET: string
}
