/**
 * Container Service
 *
 * Effect service for container operations (start, stop, get state, etc.).
 * This service wraps the container DO operations with typed errors.
 */

import { getContainer } from "@cloudflare/containers"
import { Context, Effect } from "effect"
import type { ResolvedOperatorConfig } from "../config/OperatorConfig"
import type { RestartPolicy } from "../config/RestartPolicy"
import { defaultRestartPolicy } from "../config/RestartPolicy"
import {
  AdHocContainerNotAllowedError,
  BaselineContainerError,
  ContainerNotFoundError,
  ContainerNotStoppedError,
  ContainerStartError,
  ContainerStopError,
} from "../errors/ContainerErrors"
import type { ManagedContainer, ManagedContainerEnv } from "../ManagedContainer"
import type { ContainerInfoFull, ContainerRecord } from "../types/ContainerRecord"
import type { ManagedContainerState } from "../types/ContainerState"
import type { ContainerOperatorEnv } from "@/ContainerOperator"

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Context required by ContainerService.
 */
export interface ContainerServiceContext<TEnv extends ManagedContainerEnv<ContainerOperatorEnv>> {
  /** Container DO namespace */
  containerNamespace: DurableObjectNamespace<ManagedContainer<TEnv>>
  /** Operator environment bindings */
  env: TEnv
  /** Resolved operator config */
  config: ResolvedOperatorConfig<TEnv>
  /** Container registry (from operator state) */
  containers: Map<string, ContainerRecord>
  /** Save containers to storage */
  saveContainers: () => Promise<void>
}

/**
 * ContainerService interface.
 */
export interface ContainerService {
  /**
   * Start a container with the given configuration.
   */
  start(
    name: string,
    config: Record<string, unknown>,
    restartPolicy?: RestartPolicy,
    force?: boolean,
  ): Effect.Effect<void, ContainerStartError | AdHocContainerNotAllowedError>

  /**
   * Stop a container by name.
   */
  stop(name: string): Effect.Effect<void, ContainerNotFoundError | ContainerStopError>

  /**
   * Get live state from a container DO.
   */
  getLiveState(name: string): Effect.Effect<ManagedContainerState | undefined, never>

  /**
   * Get full info for a container.
   */
  getInfo(name: string): Effect.Effect<ContainerInfoFull | null, never>

  /**
   * List all containers with their full info.
   */
  list(): Effect.Effect<ContainerInfoFull[], never>

  /**
   * Remove a stopped container from the registry.
   */
  remove(
    name: string,
  ): Effect.Effect<void, ContainerNotFoundError | ContainerNotStoppedError | BaselineContainerError>

  /**
   * Clear crash history for a container.
   */
  clearCrashHistory(name: string): Effect.Effect<void, ContainerNotFoundError>

  /**
   * Check if a container is in a crash loop.
   */
  isCrashLooping(record: ContainerRecord): boolean
}

// ============================================================================
// Service Tag
// ============================================================================

export class ContainerServiceTag extends Context.Tag("ContainerService")<
  ContainerServiceTag,
  ContainerService
>() {}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create ContainerService implementation.
 */
export const makeContainerService = <TEnv extends ManagedContainerEnv<ContainerOperatorEnv>>(
  ctx: ContainerServiceContext<TEnv>,
): ContainerService => {
  const { containerNamespace, env, config, containers, saveContainers } = ctx

  /**
   * Check if a container is in a crash loop.
   */
  const isCrashLooping = (record: ContainerRecord): boolean => {
    const { windowMs, allowedCrashes } = record.restartPolicy.crash

    if (windowMs <= 0) return false

    const crashCountToTrip = Math.max(0, allowedCrashes) + 1
    if (record.stopHistory.length < crashCountToTrip) {
      return false
    }

    const now = Date.now()
    const oldestRelevant =
      record.stopHistory[record.stopHistory.length - crashCountToTrip].timestamp

    return now - oldestRelevant < windowMs
  }

  /**
   * Derive operator status from live state.
   */
  const deriveStatus = (
    liveState: ManagedContainerState | undefined,
    desiredState: "running" | "stopped",
  ): "starting" | ManagedContainerState["status"] => {
    if (liveState) return liveState.status
    return desiredState === "running" ? "starting" : "stopped"
  }

  /**
   * Derive startedAt from live state.
   */
  const deriveStartedAt = (liveState: ManagedContainerState | undefined): number | undefined => {
    if (!liveState || liveState.uptimeMs === null) return undefined
    return Date.now() - liveState.uptimeMs
  }

  /**
   * Build full container info.
   */
  const buildContainerInfo = (
    record: ContainerRecord,
    liveState?: ManagedContainerState,
  ): ContainerInfoFull => ({
    ...record,
    status: deriveStatus(liveState, record.desiredState),
    startedAt: deriveStartedAt(liveState),
    liveState,
    isCrashLooping: isCrashLooping(record),
  })

  /**
   * Check if container name is in baseline fleet.
   */
  const isBaselineContainer = (name: string): boolean =>
    config.baselineFleet.some((spec) => spec.name === name)

  /**
   * Get container DO stub.
   */
  const getContainerStub = (name: string) =>
    getContainer(containerNamespace, name) as unknown as ManagedContainer<TEnv>

  /**
   * Get managed state from container, handling errors.
   */
  const getManagedState = (name: string): Effect.Effect<ManagedContainerState | undefined, never> =>
    Effect.tryPromise({
      try: async () => {
        const stub = getContainerStub(name)
        return await stub.getManagedState()
      },
      catch: () => undefined,
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))

  return {
    isCrashLooping,

    start: (
      name: string,
      userConfig: Record<string, unknown>,
      restartPolicy?: RestartPolicy,
      force = false,
    ) =>
      Effect.gen(function* () {
        // Check if ad-hoc containers are allowed
        if (!config.allowAdHocContainers && !isBaselineContainer(name)) {
          return yield* Effect.fail(AdHocContainerNotAllowedError.of(name))
        }

        const existing = containers.get(name)
        const policy = restartPolicy ?? existing?.restartPolicy ?? defaultRestartPolicy()

        const nextRecord: ContainerRecord = {
          name,
          config: userConfig,
          restartPolicy: policy,
          desiredState: "running",
          updatedAt: Date.now(),
          stopHistory: existing?.stopHistory ?? [],
          isBaseline: isBaselineContainer(name),
        }

        containers.set(name, nextRecord)
        yield* Effect.promise(() => saveContainers())

        // Check if already healthy
        const liveState = yield* getManagedState(name)

        const isHealthy = liveState?.status === "healthy"

        if (isHealthy && !force) {
          console.log(`[ContainerService] Container ${name} is already healthy`)
          return
        }

        if (isHealthy && force) {
          console.log(`[ContainerService] Container ${name} is healthy, force starting`)
        }

        // Build env vars
        const spec = { name, config: userConfig, restartPolicy: policy }
        const envVars = config.envVarsBuilder(spec, env)

        // Add container name env var
        envVars[config.containerNameEnvKey] = name

        // Start container
        const container = getContainerStub(name)
        yield* Effect.tryPromise({
          try: () =>
            container.startAndWaitForPorts({
              ports: 8080,
              startOptions: { envVars },
            }),
          catch: (err) => ContainerStartError.of(name, err),
        })

        console.log(`[ContainerService] Started container: ${name}`)
      }),

    stop: (name: string) =>
      Effect.gen(function* () {
        const record = containers.get(name)
        if (!record) {
          return yield* Effect.fail(ContainerNotFoundError.of(name))
        }

        // Update desired state
        record.desiredState = "stopped"
        record.updatedAt = Date.now()
        yield* Effect.promise(() => saveContainers())

        // Get live state
        const liveState = yield* getManagedState(name)

        if (!liveState) {
          console.log(`[ContainerService] Container ${name} has no live state; treating as stopped`)
          return
        }

        if (liveState.status === "stopping") {
          console.log(`[ContainerService] Container ${name} is already stopping`)
          return
        }

        if (liveState.status === "stopped" || liveState.status === "stopped_with_code") {
          console.log(`[ContainerService] Container ${name} is already stopped`)
          return
        }

        // Stop container
        yield* Effect.tryPromise({
          try: () => getContainerStub(name).stop(),
          catch: (err) => ContainerStopError.of(name, err),
        })

        console.log(`[ContainerService] Initiated stop for container: ${name}`)
      }),

    getLiveState: (name: string) => getManagedState(name),

    getInfo: (name: string) =>
      Effect.gen(function* () {
        const record = containers.get(name)
        if (!record) return null

        const liveState = yield* getManagedState(name)
        return buildContainerInfo(record, liveState)
      }),

    list: () =>
      Effect.gen(function* () {
        const records = Array.from(containers.values())
        const infos = yield* Effect.all(
          records.map((record) =>
            Effect.gen(function* () {
              const liveState = yield* getManagedState(record.name)
              return buildContainerInfo(record, liveState)
            }),
          ),
          { concurrency: "unbounded" },
        )
        return infos
      }),

    remove: (name: string) =>
      Effect.gen(function* () {
        const record = containers.get(name)
        if (!record) {
          return yield* Effect.fail(ContainerNotFoundError.of(name))
        }

        if (record.isBaseline) {
          return yield* Effect.fail(BaselineContainerError.of(name))
        }

        if (record.desiredState !== "stopped") {
          return yield* Effect.fail(
            ContainerNotStoppedError.of(name, `desiredState: ${record.desiredState}`),
          )
        }

        const liveState = yield* getManagedState(name)

        if (
          liveState &&
          liveState.status !== "stopped" &&
          liveState.status !== "stopped_with_code"
        ) {
          return yield* Effect.fail(ContainerNotStoppedError.of(name, liveState.status))
        }

        containers.delete(name)
        yield* Effect.promise(() => saveContainers())
        console.log(`[ContainerService] Removed container: ${name}`)
      }),

    clearCrashHistory: (name: string) =>
      Effect.gen(function* () {
        const record = containers.get(name)
        if (!record) {
          return yield* Effect.fail(ContainerNotFoundError.of(name))
        }

        record.stopHistory = []
        record.updatedAt = Date.now()
        yield* Effect.promise(() => saveContainers())
        console.log(`[ContainerService] Cleared crash history for: ${name}`)
      }),
  }
}
