import type { StopParams } from "@cloudflare/containers"
import {
  ManagedContainer,
  type ManagedContainerConfig,
} from "@jonbeckman/cf-container-orchestrator"
import { DEFAULT_SERVICE_CONFIG, type ServiceConfig, type ServiceEnv } from "./types"

export class APIService extends ManagedContainer<ServiceEnv> {
  // Standard Container DO config
  defaultPort = 8080
  sleepAfter = "30m" // Keep alive for 30m after last request

  // State to demonstrate configuration usage
  private config: ServiceConfig = { ...DEFAULT_SERVICE_CONFIG }
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: This is just an example
  private requestCount = 0

  /**
   * Configure how the operator identifies this container.
   * We use "SERVICE_NAME" env var to identify the container.
   */
  protected override getManagedContainerConfig(): ManagedContainerConfig {
    return {
      containerNameEnvKey: "SERVICE_NAME",
      operatorName: "global-operator", // The name of the operator singleton
    }
  }

  /**
   * Lifecycle Hook: Called when the container is started by the operator.
   * We load our configuration from environment variables here.
   */
  protected override async onContainerStart(): Promise<void> {
    this.loadConfigFromEnv()
    console.log(
      `[${this.config.serviceName}] Service started with ${this.config.maxConnections} max connections.`,
    )
  }

  /**
   * Lifecycle Hook: Called when the container is stopped.
   */
  protected override async onContainerStop(params: StopParams): Promise<void> {
    console.log(`[${this.config.serviceName}] Stopping. Reason: ${params.reason}`)
  }

  /**
   * Lifecycle Hook: Handle application errors.
   */
  protected override async onContainerError(error: unknown): Promise<void> {
    console.error(`[${this.config.serviceName}] Critical error:`, error)
  }

  /**
   * Custom business logic method (RPC accessible)
   */
  async processRequest(): Promise<{ status: string; processed: boolean }> {
    this.requestCount++

    // Simulate processing
    return { status: "processed", processed: true }
  }

  /**
   * Helper to parse env vars into typed config
   */
  private loadConfigFromEnv() {
    this.config = {
      serviceName: this.env.SERVICE_NAME || "unknown",
      logLevel:
        (this.env.LOG_LEVEL as ServiceConfig["logLevel"]) || DEFAULT_SERVICE_CONFIG.logLevel,
      maxConnections: Number(this.env.MAX_CONNECTIONS) || DEFAULT_SERVICE_CONFIG.maxConnections,
    }
  }
}
