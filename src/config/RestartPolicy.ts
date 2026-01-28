/**
 * Restart Policy Configuration
 *
 * Defines when and how containers should be restarted after stopping.
 */

import { Schema } from "effect";

// ============================================================================
// Constants
// ============================================================================

/** Default crash-loop window (ms) - 10 minutes */
export const DEFAULT_CRASH_LOOP_WINDOW_MS = 10 * 60 * 1000;

/** Default number of allowed crashes within window before crash-loop protection triggers */
export const DEFAULT_CRASH_LOOP_ALLOWED_CRASHES = 3;

// ============================================================================
// Schemas
// ============================================================================

/**
 * When the container should be restarted after stopping.
 */
export const RestartWhen = Schema.Literal("always", "on_failure", "never");
export type RestartWhen = typeof RestartWhen.Type;

/**
 * Crash-loop handling settings.
 * Determines when to stop auto-restarting a container that keeps crashing.
 */
export const CrashHandlingPolicy = Schema.Struct({
	/** Time window (ms) to consider a set of crashes part of a crash loop */
	windowMs: Schema.Number.pipe(
		Schema.positive(),
		Schema.annotations({ default: DEFAULT_CRASH_LOOP_WINDOW_MS }),
	),
	/** Number of allowed crashes within the window before crash-loop protection triggers */
	allowedCrashes: Schema.Number.pipe(
		Schema.int(),
		Schema.nonNegative(),
		Schema.annotations({ default: DEFAULT_CRASH_LOOP_ALLOWED_CRASHES }),
	),
});
export type CrashHandlingPolicy = typeof CrashHandlingPolicy.Type;

/**
 * Complete restart policy for a container.
 */
export const RestartPolicy = Schema.Struct({
	/** When to restart the container */
	when: RestartWhen,
	/** Crash loop detection settings */
	crash: CrashHandlingPolicy,
});
export type RestartPolicy = typeof RestartPolicy.Type;

/**
 * Create a default restart policy.
 * Restarts on failure with standard crash loop protection.
 */
export const defaultRestartPolicy = (): RestartPolicy => ({
	when: "on_failure",
	crash: {
		windowMs: DEFAULT_CRASH_LOOP_WINDOW_MS,
		allowedCrashes: DEFAULT_CRASH_LOOP_ALLOWED_CRASHES,
	},
});

/**
 * Create a restart policy that always restarts.
 */
export const alwaysRestartPolicy = (): RestartPolicy => ({
	when: "always",
	crash: {
		windowMs: DEFAULT_CRASH_LOOP_WINDOW_MS,
		allowedCrashes: DEFAULT_CRASH_LOOP_ALLOWED_CRASHES,
	},
});

/**
 * Create a restart policy that never restarts.
 */
export const neverRestartPolicy = (): RestartPolicy => ({
	when: "never",
	crash: {
		windowMs: 0,
		allowedCrashes: 0,
	},
});
