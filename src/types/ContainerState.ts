/**
 * Container State Types
 *
 * Types representing the runtime state of containers.
 */

/**
 * Base container status from @cloudflare/containers.
 */
export type ContainerStatus =
	| "running"
	| "stopping"
	| "stopped"
	| "stopped_with_code"
	| "healthy";

/**
 * Base state returned by Container.getState().
 * This mirrors the structure from @cloudflare/containers.
 */
export type BaseContainerState = {
	lastChange: number;
	status: ContainerStatus;
	exitCode?: number;
};

/**
 * Extended container state with timing information.
 * Returned by ManagedContainer.getState().
 */
export interface ManagedContainerState {
	/** Last state change timestamp */
	lastChange: number;
	/** Current status */
	status: ContainerStatus;
	/** Exit code (only for stopped_with_code) */
	exitCode?: number;
	/** How long the container took to start, in milliseconds. Null if not yet started. */
	startupDurationMs: number | null;
	/** Human-readable startup duration (e.g., "45.12s"). Null if not yet started. */
	startupDuration: string | null;
	/** How long the container has been running, in milliseconds. Null if not running. */
	uptimeMs: number | null;
	/** Human-readable uptime (e.g., "2h 15m 30s"). Null if not running. */
	uptime: string | null;
}

/**
 * Desired state (operator intent) for a container.
 * This is the primary signal for whether a stop should be considered "expected".
 */
export type DesiredState = "running" | "stopped";

/**
 * Status as seen by the operator (includes "starting" for containers not yet running).
 */
export type OperatorStatus = "starting" | ContainerStatus;

/**
 * Format milliseconds as human-readable duration.
 */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${(ms / 1000).toFixed(2)}s`;
}
