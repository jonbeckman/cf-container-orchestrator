/**
 * Lifecycle Event Types
 *
 * Types for lifecycle events sent from containers to the operator.
 */

/**
 * Lifecycle event type.
 */
export type LifecycleEventType = "started" | "stopped" | "error";

/**
 * Reason for container stop.
 */
export type StopReason = "exit" | "runtime_signal" | "version_rollout";

/**
 * Lifecycle event sent from container DOs to the operator.
 */
export interface LifecycleEvent {
	/** Type of lifecycle event */
	type: LifecycleEventType;
	/** Name of the container (used as DO routing key) */
	containerName: string;
	/** When the event occurred */
	timestamp: number;
	/** Error message (for "error" type) */
	error?: string;
	/** Exit code from container (for "stopped" type) */
	exitCode?: number;
	/** Reason for stop (for "stopped" type) */
	reason?: StopReason;
}

/**
 * Record of a container stop event (for crash history).
 */
export interface StopRecord {
	/** When the container stopped */
	timestamp: number;
	/** Type of stop: normal stop or error */
	type: "stopped" | "error";
	/** Error message if type is "error" */
	error?: string;
}

/**
 * Create a lifecycle event for container start.
 */
export const createStartedEvent = (containerName: string): LifecycleEvent => ({
	type: "started",
	containerName,
	timestamp: Date.now(),
});

/**
 * Create a lifecycle event for container stop.
 */
export const createStoppedEvent = (
	containerName: string,
	exitCode?: number,
	reason?: StopReason,
): LifecycleEvent => ({
	type: "stopped",
	containerName,
	timestamp: Date.now(),
	exitCode,
	reason,
});

/**
 * Create a lifecycle event for container error.
 */
export const createErrorEvent = (
	containerName: string,
	error: string,
): LifecycleEvent => ({
	type: "error",
	containerName,
	timestamp: Date.now(),
	error,
});

/**
 * Create a lifecycle event for version rollout stop.
 * Version rollouts are not counted as crashes and always trigger restart.
 */
export const createVersionRolloutEvent = (
	containerName: string,
): LifecycleEvent => ({
	type: "stopped",
	containerName,
	timestamp: Date.now(),
	reason: "version_rollout",
});
