/**
 * Container Operator Durable Object
 *
 * Generic operator that manages multiple container instances with:
 * - Configurable min replica set with auto-reconciliation
 * - Restart policies with crash loop protection
 * - Lifecycle event handling from containers
 * - Alarm-based periodic reconciliation
 *
 * Architecture:
 * - Worker API → Operator DO (RPC) → Container DOs (ManagedContainer)
 * - Operator receives lifecycle events (start/stop) from container DOs via RPC
 * - Operator maintains state of all known containers
 */

import { DurableObject } from "cloudflare:workers"
import { Cause, Effect } from "effect"

import type {
  ContainerStartConfig,
  OperatorConfig,
  ResolvedOperatorConfig,
} from "./config/OperatorConfig"
import { resolveOperatorConfig } from "./config/OperatorConfig"
import { defaultRestartPolicy } from "./config/RestartPolicy"
import type { ManagedContainer, ManagedContainerEnv } from "./ManagedContainer"
import type { ContainerService } from "./services/ContainerService"
import { makeContainerService } from "./services/ContainerService"
import type { LifecycleService } from "./services/LifecycleService"
import { makeLifecycleService } from "./services/LifecycleService"
import type { ReconcileService } from "./services/ReconcileService"
import { makeReconcileService } from "./services/ReconcileService"
import type { ContainerInfoFull, ContainerRecord } from "./types/ContainerRecord"
import type { LifecycleEvent } from "./types/LifecycleEvent"

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Minimum environment bindings required for ContainerOperator.
 * User's environment must extend this.
 *
 * Note: The container namespace binding is configurable via `containerNamespaceKey`.
 * Your env must have a binding with that name containing the container DO namespace.
 */
export interface ContainerOperatorEnv extends ManagedContainerEnv<ContainerOperatorEnv> {
  /**
   * DurableObject namespace for managed containers.
   * The actual binding name is configurable via `containerNamespaceKey`.
   */
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContainerOperator class with the given configuration.
 *
 * @example
 * ```typescript
 * export const ContainerOperator = createContainerOperator({
 *   minReplicaSet: [
 *     { name: "default", config: { strategy: "MyStrategy" }, restartPolicy: defaultRestartPolicy() }
 *   ],
 *   envVarsBuilder: (spec, env) => ({
 *     STRATEGY: spec.config.strategy as string,
 *     API_KEY: env.API_KEY,
 *   }),
 * })
 * ```
 */
/**
 * Public interface for the ContainerOperator.
 * This is the type exposed to consumers.
 */
export interface ContainerOperatorInterface<
  TEnv extends ContainerOperatorEnv,
> extends DurableObject<TEnv> {
  alarm(): Promise<void>
  handleLifecycleEvent(event: LifecycleEvent): Promise<void>
  startContainer(config: ContainerStartConfig, force?: boolean): Promise<void>
  stopContainer(name: string): Promise<void>
  getContainerInfo(name: string): Promise<ContainerInfoFull | null>
  listContainers(): Promise<ContainerInfoFull[]>
  removeContainer(name: string): Promise<void>
  clearCrashHistory(name: string): Promise<void>
  reconcile(): Promise<void>
  getConfig(): Omit<ResolvedOperatorConfig<TEnv>, "envVarsBuilder">
}

export function createContainerOperator<TEnv extends ContainerOperatorEnv>(
  config: OperatorConfig<TEnv>,
): new (ctx: DurableObjectState, env: TEnv) => ContainerOperatorInterface<TEnv> {
  const resolvedConfig = resolveOperatorConfig(config)

  return class ContainerOperatorImpl extends DurableObject<TEnv> {
    /**
     * Map of container name → ContainerRecord
     * Persisted to storage
     */
    #containers: Map<string, ContainerRecord> = new Map()

    /**
     * Resolved operator configuration
     */
    readonly #config: ResolvedOperatorConfig<TEnv> = resolvedConfig

    /**
     * Effect services
     */
    #containerService!: ContainerService
    #lifecycleService!: LifecycleService
    #reconcileService!: ReconcileService

    /**
     * References to base class members (for type compatibility)
     */
    readonly #ctx: DurableObjectState
    readonly #env: TEnv

    constructor(ctx: DurableObjectState, env: TEnv) {
      super(ctx, env)
      this.#ctx = ctx
      this.#env = env

      // Load persisted state and initialize services
      ctx.blockConcurrencyWhile(async () => {
        const containerFleet = await ctx.storage.get<[string, ContainerRecord][] | undefined>(
          "containers",
        )
        if (containerFleet) {
          this.#containers = new Map(containerFleet)
        }

        // Initialize min replica set containers that don't exist yet
        for (const spec of this.#config.minReplicaSet) {
          if (!this.#containers.has(spec.name)) {
            this.#containers.set(spec.name, {
              name: spec.name,
              config: spec.config,
              restartPolicy: spec.restartPolicy,
              desiredState: "running",
              updatedAt: Date.now(),
              stopHistory: [],
              isMinReplicaSet: true,
            })
          } else {
            // Mark existing containers as min replica set
            const record = this.#containers.get(spec.name)
            if (!record) {
              throw new Error(`Container record not found for ${spec.name}`)
            }
            record.isMinReplicaSet = true
          }
        }

        await this.#saveContainers()
        this.#initializeServices()

        // Schedule initial reconciliation alarm
        if (this.#config.reconcileIntervalMs > 0) {
          const existingAlarm = await ctx.storage.getAlarm()
          if (!existingAlarm) {
            await ctx.storage.setAlarm(Date.now() + this.#config.reconcileIntervalMs)
          }
        }
      })
    }

    /**
     * Initialize Effect services with current state
     */
    #initializeServices(): void {
      const saveContainers = () => this.#saveContainers()
      const scheduleRestart = (record: ContainerRecord, reason: string) =>
        this.#scheduleRestart(record, reason)

      // Get the container namespace from the configured binding key
      const containerNamespace = (this.#env as Record<string, unknown>)[
        this.#config.containerNamespaceKey
      ] as DurableObjectNamespace<ManagedContainer<TEnv>>

      this.#containerService = makeContainerService({
        containerNamespace,
        env: this.#env,
        config: this.#config,
        containers: this.#containers,
        saveContainers,
      })

      this.#lifecycleService = makeLifecycleService({
        containerService: this.#containerService,
        containers: this.#containers,
        saveContainers,
        scheduleRestart,
      })

      this.#reconcileService = makeReconcileService({
        containerService: this.#containerService,
        minReplicaSet: this.#config.minReplicaSet,
        containers: this.#containers,
        saveContainers,
      })
    }

    /**
     * Persist the containers map to storage
     */
    async #saveContainers(): Promise<void> {
      await this.#ctx.storage.put("containers", Array.from(this.#containers))
    }

    /**
     * Schedule a container restart without blocking.
     */
    #scheduleRestart(record: ContainerRecord, reason: string): void {
      console.log(
        `[ContainerOperator] Auto-restarting container: ${record.name} (reason: ${reason})`,
      )
      this.#ctx.waitUntil(
        Effect.runPromise(
          this.#containerService
            .start(record.name, record.config, record.restartPolicy, false)
            .pipe(
              Effect.catchAll((err) => {
                console.error(`[ContainerOperator] Failed to auto-restart ${record.name}:`, err)
                return Effect.void
              }),
            ),
        ),
      )
    }

    // ============================================================================
    // Alarm Handler
    // ============================================================================

    /**
     * Handle alarm for periodic reconciliation.
     */
    async alarm(): Promise<void> {
      console.log("[ContainerOperator] Reconciliation alarm triggered")

      await Effect.runPromise(
        this.#reconcileService.reconcile().pipe(
          Effect.catchAll((err) => {
            console.error("[ContainerOperator] Reconciliation failed:", err)
            return Effect.void
          }),
        ),
      )

      // Schedule next alarm
      if (this.#config.reconcileIntervalMs > 0) {
        await this.#ctx.storage.setAlarm(Date.now() + this.#config.reconcileIntervalMs)
      }
    }

    // ============================================================================
    // RPC Methods - Called by Worker API and ManagedContainer DOs
    // ============================================================================

    /**
     * Handle lifecycle event from a container DO.
     * Called via RPC from ManagedContainer.
     */
    async handleLifecycleEvent(event: LifecycleEvent): Promise<void> {
      await Effect.runPromise(
        this.#lifecycleService.handleEvent(event).pipe(
          Effect.catchAll((err) => {
            console.error("[ContainerOperator] Lifecycle event handling failed:", err)
            return Effect.void
          }),
        ),
      )
    }

    /**
     * Start a container with the given configuration.
     */
    async startContainer(config: ContainerStartConfig, force = false): Promise<void> {
      const restartPolicy = config.restartPolicy ?? defaultRestartPolicy()
      const effect = this.#containerService.start(config.name, config.config, restartPolicy, force)
      const result = await Effect.runPromiseExit(effect)
      if (result._tag === "Failure") {
        throw Cause.squash(result.cause)
      }
    }

    /**
     * Stop a container by name.
     */
    async stopContainer(name: string): Promise<void> {
      const effect = this.#containerService.stop(name)
      const result = await Effect.runPromiseExit(effect)
      if (result._tag === "Failure") {
        throw Cause.squash(result.cause)
      }
    }

    /**
     * Get info for a specific container.
     */
    async getContainerInfo(name: string): Promise<ContainerInfoFull | null> {
      return Effect.runPromise(this.#containerService.getInfo(name))
    }

    /**
     * List all containers.
     */
    async listContainers(): Promise<ContainerInfoFull[]> {
      return Effect.runPromise(this.#containerService.list())
    }

    /**
     * Remove a stopped container from the registry.
     */
    async removeContainer(name: string): Promise<void> {
      const effect = this.#containerService.remove(name)
      const result = await Effect.runPromiseExit(effect)
      if (result._tag === "Failure") {
        throw Cause.squash(result.cause)
      }
    }

    /**
     * Clear crash history for a container.
     */
    async clearCrashHistory(name: string): Promise<void> {
      const effect = this.#containerService.clearCrashHistory(name)
      const result = await Effect.runPromiseExit(effect)
      if (result._tag === "Failure") {
        throw Cause.squash(result.cause)
      }
    }

    /**
     * Trigger reconciliation manually.
     */
    async reconcile(): Promise<void> {
      const effect = this.#reconcileService.reconcile().pipe(
        Effect.catchAll((err) => {
          console.error("[ContainerOperator] Manual reconciliation failed:", err)
          return Effect.succeed(undefined)
        }),
      )
      await Effect.runPromise(effect)
    }

    /**
     * Get the operator configuration (for debugging).
     */
    getConfig(): Omit<ResolvedOperatorConfig<TEnv>, "envVarsBuilder"> {
      return {
        minReplicaSet: this.#config.minReplicaSet,
        containerNameEnvKey: this.#config.containerNameEnvKey,
        reconcileIntervalMs: this.#config.reconcileIntervalMs,
        allowAdHocContainers: this.#config.allowAdHocContainers,
        containerNamespaceKey: this.#config.containerNamespaceKey,
      }
    }
  }
}

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type for the operator class returned by createContainerOperator.
 */
export type ContainerOperatorClass<TEnv extends ContainerOperatorEnv> = ReturnType<
  typeof createContainerOperator<TEnv>
>

/**
 * Instance type for the operator.
 */
export type ContainerOperatorInstance<TEnv extends ContainerOperatorEnv> = InstanceType<
  ContainerOperatorClass<TEnv>
>
