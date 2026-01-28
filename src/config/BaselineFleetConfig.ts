/**
 * Baseline Fleet Configuration
 *
 * Defines containers that should be automatically managed by the operator.
 * These containers are reconciled on startup and via periodic alarms.
 */

import { Schema } from "effect";
import { defaultRestartPolicy, RestartPolicy } from "./RestartPolicy";

// ============================================================================
// Schemas
// ============================================================================

/**
 * User-defined configuration for a container.
 * This is passed to the envVarsBuilder function to generate container env vars.
 */
export const ContainerUserConfig = Schema.Record({
	key: Schema.String,
	value: Schema.Unknown,
});
export type ContainerUserConfig = typeof ContainerUserConfig.Type;

/**
 * Specification for a single container in the baseline fleet.
 */
export const ContainerSpec = Schema.Struct({
	/** Unique name for this container (used as DO ID) */
	name: Schema.String.pipe(Schema.nonEmptyString()),
	/** User-defined configuration passed to envVarsBuilder */
	config: ContainerUserConfig,
	/** Restart policy for this container */
	restartPolicy: RestartPolicy,
});
export type ContainerSpec = typeof ContainerSpec.Type;

/**
 * Array of container specifications forming the baseline fleet.
 */
export const BaselineFleetConfig = Schema.Array(ContainerSpec);
export type BaselineFleetConfig = typeof BaselineFleetConfig.Type;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Create a container spec with default restart policy.
 */
export const createContainerSpec = (
	name: string,
	config: ContainerUserConfig = {},
	restartPolicy: RestartPolicy = defaultRestartPolicy(),
): ContainerSpec => ({
	name,
	config,
	restartPolicy,
});
