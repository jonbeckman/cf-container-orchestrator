/**
 * Container Record Types
 *
 * Types for container records persisted by the operator.
 */

import type { RestartPolicy } from "../config/RestartPolicy"
import type { DesiredState, ManagedContainerState, OperatorStatus } from "./ContainerState"
import type { StopRecord } from "./LifecycleEvent"

/**
 * Persisted record (registry + operator intent) for a container.
 * NOTE: Runtime status is derived from the container DO via `getState()`.
 */
export interface ContainerRecord {
  /** Unique name for this container (used as DO ID) */
  name: string
  /** User-defined configuration (passed to envVarsBuilder) */
  config: Record<string, unknown>
  /** Restart policy for this container */
  restartPolicy: RestartPolicy
  /** Operator intent for this container (used to prevent unwanted auto-restarts) */
  desiredState: DesiredState
  /** When this record was last updated (config/intent/history) */
  updatedAt: number
  /** Stop history for crash loop detection (most recent last) */
  stopHistory: StopRecord[]
  /** Whether this container is part of the min replica set */
  isMinReplicaSet: boolean
}

/**
 * Container info returned by the operator.
 * Combines the persisted record with derived runtime state.
 */
export interface ContainerInfo extends ContainerRecord {
  /** Current status of the container */
  status: OperatorStatus
  /** When the container was started */
  startedAt?: number
}

/**
 * Full container info including live state and crash loop status.
 * This is the public return type from getContainerInfo and listContainers.
 */
export interface ContainerInfoFull extends ContainerInfo {
  /** Live state from the container DO */
  liveState?: ManagedContainerState
  /** Whether the container is in a crash loop */
  isCrashLooping: boolean
}

/**
 * Create a new container record.
 */
export const createContainerRecord = (
  name: string,
  config: Record<string, unknown>,
  restartPolicy: RestartPolicy,
  isMinReplicaSet: boolean,
  existingStopHistory: StopRecord[] = [],
): ContainerRecord => ({
  name,
  config,
  restartPolicy,
  desiredState: "running",
  updatedAt: Date.now(),
  stopHistory: existingStopHistory,
  isMinReplicaSet,
})
