/**
 * Configuration schemas and types for the container operator.
 */

export {
  MinReplicaSetConfig,
  ContainerSpec,
  ContainerUserConfig,
  createContainerSpec,
} from "./MinReplicaSetConfig"
export {
  type ContainerStartConfig,
  DEFAULT_CONTAINER_NAME_ENV_KEY,
  DEFAULT_RECONCILE_INTERVAL_MS,
  type EnvVarsBuilder,
  type OperatorConfig,
  type ResolvedOperatorConfig,
  resolveOperatorConfig,
} from "./OperatorConfig"
export {
  alwaysRestartPolicy,
  CrashHandlingPolicy,
  DEFAULT_CRASH_LOOP_ALLOWED_CRASHES,
  DEFAULT_CRASH_LOOP_WINDOW_MS,
  defaultRestartPolicy,
  neverRestartPolicy,
  RestartPolicy,
  RestartWhen,
} from "./RestartPolicy"
