/**
 * Operator Configuration
 *
 * Main configuration schema for the ContainerOperator.
 * Users provide this when creating an operator instance.
 */

import type { MinReplicaSetConfig, ContainerSpec } from "./MinReplicaSetConfig"
import type { RestartPolicy } from "./RestartPolicy"

// ============================================================================
// Constants
// ============================================================================

/** Default reconcile interval (ms) - 1 minute */
export const DEFAULT_RECONCILE_INTERVAL_MS = 60 * 1000

/** Default env var key for container name */
export const DEFAULT_CONTAINER_NAME_ENV_KEY = "CONTAINER_NAME"

/** Default binding key for the container namespace */
export const DEFAULT_CONTAINER_NAMESPACE_KEY = "MANAGED_CONTAINER"

// ============================================================================
// Types
// ============================================================================

/**
 * Function that builds environment variables for a container.
 * Called when starting a container to generate the env vars passed to the container process.
 *
 * @param spec - The container specification
 * @param env - The operator's environment bindings
 * @returns Record of env var name → value
 */
export type EnvVarsBuilder<TEnv> = (spec: ContainerSpec, env: TEnv) => Record<string, string>

/**
 * Configuration for creating a ContainerOperator.
 */
export interface OperatorConfig<TEnv> {
  /**
   * Array of container specs to auto-manage.
   * These containers are reconciled on startup and via periodic alarms.
   */
  minReplicaSet: MinReplicaSetConfig

  /**
   * Function to build environment variables for container processes.
   * Called when starting a container.
   */
  envVarsBuilder: EnvVarsBuilder<TEnv>

  /**
   * Environment variable key used to pass the container name to the container process.
   * The ManagedContainer uses this to identify itself when reporting lifecycle events.
   * @default "CONTAINER_NAME"
   */
  containerNameEnvKey?: string

  /**
   * How often to check and reconcile the min replica set (ms).
   * Set to 0 to disable periodic reconciliation.
   * @default 60000 (1 minute)
   */
  reconcileIntervalMs?: number

  /**
   * Whether to allow ad-hoc containers (not in min replica set) to be created.
   * @default true
   */
  allowAdHocContainers?: boolean

  /**
   * Name of the environment binding that contains the container DurableObject namespace.
   * @default "MANAGED_CONTAINER"
   */
  containerNamespaceKey?: string
}

/**
 * Resolved operator config with all defaults applied.
 */
export interface ResolvedOperatorConfig<TEnv> {
  minReplicaSet: MinReplicaSetConfig
  envVarsBuilder: EnvVarsBuilder<TEnv>
  containerNameEnvKey: string
  reconcileIntervalMs: number
  allowAdHocContainers: boolean
  containerNamespaceKey: string
}

/**
 * Apply defaults to operator config.
 */
export const resolveOperatorConfig = <TEnv>(
  config: OperatorConfig<TEnv>,
): ResolvedOperatorConfig<TEnv> => ({
  minReplicaSet: config.minReplicaSet,
  envVarsBuilder: config.envVarsBuilder,
  containerNameEnvKey: config.containerNameEnvKey ?? DEFAULT_CONTAINER_NAME_ENV_KEY,
  reconcileIntervalMs: config.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS,
  allowAdHocContainers: config.allowAdHocContainers ?? true,
  containerNamespaceKey: config.containerNamespaceKey ?? DEFAULT_CONTAINER_NAMESPACE_KEY,
})

/**
 * Configuration for starting a container.
 * Used by startContainer() RPC method.
 */
export interface ContainerStartConfig {
  /** Unique name for this container (used as DO ID) */
  name: string
  /** User-defined config passed to envVarsBuilder */
  config: Record<string, unknown>
  /** Optional restart policy override */
  restartPolicy?: RestartPolicy
}
