/**
 * Reconcile Service
 *
 * Effect service for min replica set reconciliation.
 * Ensures all min replica set containers match their desired state.
 */

import { Context, Effect } from "effect"
import type { MinReplicaSetConfig } from "../config/MinReplicaSetConfig"
import { PartialReconcileError, ReconcileError } from "../errors/ReconcileErrors"
import type { ContainerRecord } from "../types/ContainerRecord"
import type { ContainerService } from "./ContainerService"

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Context required by ReconcileService.
 */
export interface ReconcileServiceContext {
  /** Container service for operations */
  containerService: ContainerService
  /** Min replica set configuration */
  minReplicaSet: MinReplicaSetConfig
  /** Container registry */
  containers: Map<string, ContainerRecord>
  /** Save containers to storage */
  saveContainers: () => Promise<void>
}

/**
 * Result of a reconciliation run.
 */
export interface ReconcileResult {
  /** Number of containers that were already in desired state */
  alreadyHealthy: number
  /** Number of containers that were started */
  started: number
  /** Containers that failed to start */
  failed: Array<{ name: string; error: unknown }>
}

/**
 * ReconcileService interface.
 */
export interface ReconcileService {
  /**
   * Reconcile min replica set.
   * Ensures all min replica set containers are running and healthy.
   */
  reconcile(): Effect.Effect<ReconcileResult, ReconcileError | PartialReconcileError>

  /**
   * Check if reconciliation is needed.
   */
  needsReconcile(): Effect.Effect<boolean, never>
}

// ============================================================================
// Service Tag
// ============================================================================

export class ReconcileServiceTag extends Context.Tag("ReconcileService")<
  ReconcileServiceTag,
  ReconcileService
>() {}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create ReconcileService implementation.
 */
export const makeReconcileService = (ctx: ReconcileServiceContext): ReconcileService => {
  const { containerService, minReplicaSet, containers } = ctx

  return {
    reconcile: () =>
      Effect.gen(function* () {
        console.log(
          `[ReconcileService] Starting reconciliation for ${minReplicaSet.length} min replica set containers`,
        )

        const result: ReconcileResult = {
          alreadyHealthy: 0,
          started: 0,
          failed: [],
        }

        // Process each min replica set container
        for (const spec of minReplicaSet) {
          const record = containers.get(spec.name)

          // Check if container exists and is healthy
          const liveState = yield* containerService.getLiveState(spec.name)
          const isHealthy = liveState?.status === "healthy"

          if (isHealthy) {
            console.log(`[ReconcileService] Container ${spec.name} is healthy`)
            result.alreadyHealthy++
            continue
          }

          // Check if in crash loop
          if (record && containerService.isCrashLooping(record)) {
            console.log(`[ReconcileService] Container ${spec.name} is in crash loop, skipping`)
            result.failed.push({
              name: spec.name,
              error: "Container is in crash loop",
            })
            continue
          }

          // Check if desired state is stopped (user explicitly stopped it)
          if (record?.desiredState === "stopped") {
            console.log(`[ReconcileService] Container ${spec.name} desiredState=stopped, skipping`)
            continue
          }

          // Start or restart the container
          console.log(`[ReconcileService] Starting container ${spec.name}`)
          const startResult = yield* containerService
            .start(spec.name, spec.config, spec.restartPolicy, false)
            .pipe(
              Effect.map(() => ({ success: true as const })),
              Effect.catchAll((err) => Effect.succeed({ success: false as const, error: err })),
            )

          if (startResult.success) {
            result.started++
          } else {
            result.failed.push({ name: spec.name, error: startResult.error })
          }
        }

        console.log(
          `[ReconcileService] Reconciliation complete: ` +
            `${result.alreadyHealthy} healthy, ${result.started} started, ${result.failed.length} failed`,
        )

        // Report partial failures
        if (result.failed.length > 0 && result.started > 0) {
          return yield* Effect.fail(
            PartialReconcileError.of(result.failed, result.alreadyHealthy + result.started),
          )
        }

        // Report complete failure
        if (result.failed.length > 0 && result.started === 0 && result.alreadyHealthy === 0) {
          return yield* Effect.fail(
            ReconcileError.of(
              `All ${result.failed.length} min replica set containers failed to start`,
            ),
          )
        }

        return result
      }),

    needsReconcile: () =>
      Effect.gen(function* () {
        for (const spec of minReplicaSet) {
          const record = containers.get(spec.name)

          // Skip if user explicitly stopped it
          if (record?.desiredState === "stopped") {
            continue
          }

          // Skip if in crash loop
          if (record && containerService.isCrashLooping(record)) {
            continue
          }

          // Check if healthy
          const liveState = yield* containerService.getLiveState(spec.name)
          if (liveState?.status !== "healthy") {
            return true
          }
        }

        return false
      }),
  }
}
