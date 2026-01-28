/**
 * Container Operator
 *
 * A generic Cloudflare Containers operator with:
 * - Configurable baseline fleet with auto-reconciliation
 * - Restart policies with crash loop protection
 * - Effect-based typed errors and services
 *
 * @example
 * ```typescript
 * import {
 *   createContainerOperator,
 *   ManagedContainer,
 *   defaultRestartPolicy,
 * } from "@jonbeckman/cf-container-orchestrator"
 *
 * // 1. Create your container DO by extending ManagedContainer
 * export class MyContainer extends ManagedContainer<MyEnv> {
 *   defaultPort = 8080
 *   sleepAfter = "30m"
 * }
 *
 * // 2. Create the operator with your configuration
 * export const ContainerOperator = createContainerOperator({
 *   baselineFleet: [
 *     {
 *       name: "default",
 *       config: { myConfigKey: "value" },
 *       restartPolicy: defaultRestartPolicy(),
 *     },
 *   ],
 *   envVarsBuilder: (spec, env) => ({
 *     MY_CONFIG: spec.config.myConfigKey as string,
 *     API_KEY: env.API_KEY,
 *   }),
 * })
 * ```
 */

// ============================================================================
// Main Exports
// ============================================================================

// Container Operator factory
export {
	type ContainerOperatorClass,
	type ContainerOperatorEnv,
	type ContainerOperatorInstance,
	createContainerOperator,
} from "./ContainerOperator";

// ManagedContainer base class
export {
	ManagedContainer,
	type ManagedContainerConfig,
	type ManagedContainerEnv,
	type OperatorStub,
} from "./ManagedContainer";

// ============================================================================
// Configuration
// ============================================================================

export {
	alwaysRestartPolicy,
	BaselineFleetConfig,
	ContainerSpec,
	type ContainerStartConfig,
	// Baseline Fleet
	ContainerUserConfig,
	CrashHandlingPolicy,
	createContainerSpec,
	DEFAULT_CONTAINER_NAME_ENV_KEY,
	DEFAULT_CRASH_LOOP_ALLOWED_CRASHES,
	DEFAULT_CRASH_LOOP_WINDOW_MS,
	DEFAULT_RECONCILE_INTERVAL_MS,
	defaultRestartPolicy,
	// Operator Config
	type EnvVarsBuilder,
	neverRestartPolicy,
	type OperatorConfig,
	type ResolvedOperatorConfig,
	RestartPolicy,
	// Restart Policy
	RestartWhen,
	resolveOperatorConfig,
} from "./config";

// ============================================================================
// Types
// ============================================================================

export {
	type BaseContainerState,
	type ContainerInfo,
	type ContainerInfoFull,
	// Container Records
	type ContainerRecord,
	// Container State
	type ContainerStatus,
	createContainerRecord,
	createErrorEvent,
	createStartedEvent,
	createStoppedEvent,
	createVersionRolloutEvent,
	type DesiredState,
	formatDuration,
	type LifecycleEvent,
	// Lifecycle Events
	type LifecycleEventType,
	type ManagedContainerState,
	type OperatorStatus,
	type StopReason,
	type StopRecord,
} from "./types";

// ============================================================================
// Errors
// ============================================================================

export {
	AdHocContainerNotAllowedError,
	BaselineContainerError,
	type ContainerError,
	// Container Errors
	ContainerNotFoundError,
	ContainerNotStoppedError,
	ContainerStartError,
	ContainerStopError,
	CrashLoopDetectedError,
	PartialReconcileError,
	// Reconcile Errors
	ReconcileError,
	type ReconcileErrorType,
} from "./errors";

// ============================================================================
// Services (for advanced usage)
// ============================================================================

export {
	type ContainerService,
	// Container Service
	type ContainerServiceContext,
	ContainerServiceTag,
	type LifecycleService,
	// Lifecycle Service
	type LifecycleServiceContext,
	LifecycleServiceTag,
	makeContainerService,
	makeLifecycleService,
	makeReconcileService,
	type ReconcileResult,
	type ReconcileService,
	// Reconcile Service
	type ReconcileServiceContext,
	ReconcileServiceTag,
} from "./services";
