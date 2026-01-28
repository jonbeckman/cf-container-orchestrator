/**
 * Lifecycle Service
 *
 * Effect service for handling container lifecycle events.
 * Processes events from containers and triggers restarts based on policy.
 */

import { Context, Effect } from "effect";
import type { ManagedContainerEnv } from "../ManagedContainer";
import type { ContainerRecord } from "../types/ContainerRecord";
import type { LifecycleEvent } from "../types/LifecycleEvent";
import type { ContainerService } from "./ContainerService";

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Context required by LifecycleService.
 */
export interface LifecycleServiceContext<TEnv extends ManagedContainerEnv> {
	/** Container service for operations */
	containerService: ContainerService<TEnv>;
	/** Container registry */
	containers: Map<string, ContainerRecord>;
	/** Save containers to storage */
	saveContainers: () => Promise<void>;
	/** Schedule a restart (non-blocking) */
	scheduleRestart: (record: ContainerRecord, reason: string) => void;
}

/**
 * LifecycleService interface.
 */
export interface LifecycleService {
	/**
	 * Handle a lifecycle event from a container.
	 */
	handleEvent(event: LifecycleEvent): Effect.Effect<void, never>;
}

// ============================================================================
// Service Tag
// ============================================================================

export class LifecycleServiceTag extends Context.Tag("LifecycleService")<
	LifecycleServiceTag,
	LifecycleService
>() {}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Create LifecycleService implementation.
 */
export const makeLifecycleService = <TEnv extends ManagedContainerEnv>(
	ctx: LifecycleServiceContext<TEnv>,
): LifecycleService => {
	const { containerService, containers, saveContainers, scheduleRestart } = ctx;

	/**
	 * Record a stop event in the container's history.
	 */
	const recordStop = (
		record: ContainerRecord,
		type: "stopped" | "error",
		error?: string,
		timestamp: number = Date.now(),
	): void => {
		record.stopHistory.push({ timestamp, type, error });

		const maxHistory =
			Math.max(0, record.restartPolicy.crash.allowedCrashes) + 1;
		if (record.stopHistory.length > maxHistory) {
			record.stopHistory = record.stopHistory.slice(-maxHistory);
		}
	};

	return {
		handleEvent: (event: LifecycleEvent) =>
			Effect.gen(function* () {
				const record = containers.get(event.containerName);

				if (!record) {
					console.log(
						`[LifecycleService] Received ${event.type} for unknown container: ${event.containerName}`,
					);
					return;
				}

				record.updatedAt = Date.now();

				// Handle started event
				if (event.type === "started") {
					console.log(
						`[LifecycleService] Container ${event.containerName} reported started`,
					);
					yield* Effect.promise(() => saveContainers());
					return;
				}

				// Handle stopped/error events
				if (event.type === "error") {
					console.error(
						`[LifecycleService] Container ${event.containerName} error: ${event.error}`,
					);
				}

				console.log(
					`[LifecycleService] Container ${event.containerName} stopped` +
						(event.exitCode !== undefined
							? ` (exitCode: ${event.exitCode}, reason: ${event.reason})`
							: ""),
				);

				// Detect version rollout - this is NOT a crash and should always restart
				// Check both the reason field and error message for backwards compatibility
				const isVersionRollout =
					event.reason === "version_rollout" ||
					(event.error?.includes("new version rollout") ?? false);

				if (isVersionRollout) {
					console.log(
						`[LifecycleService] Container ${event.containerName} stopped due to version rollout, ` +
							`will restart (not counted as crash)`,
					);
					yield* Effect.promise(() => saveContainers());

					// Desired stop → don't restart even for version rollout
					if (record.desiredState !== "running") {
						console.log(
							`[LifecycleService] Container ${event.containerName} desiredState=stopped. NOT auto-restarting.`,
						);
						return;
					}

					// Always restart for version rollout (bypass policy and crash loop checks)
					scheduleRestart(record, "version rollout");
					return;
				}

				const stopMessage =
					event.type === "error"
						? event.error
						: event.exitCode !== undefined
							? `exit ${event.exitCode}: ${event.reason}`
							: undefined;

				// Track crash-loop history only when we wanted it running
				if (record.desiredState === "running") {
					recordStop(record, event.type, stopMessage, event.timestamp);
				}

				yield* Effect.promise(() => saveContainers());

				// Desired stop → never restart
				if (record.desiredState !== "running") {
					console.log(
						`[LifecycleService] Container ${event.containerName} desiredState=stopped. NOT auto-restarting.`,
					);
					return;
				}

				// Policy gate
				if (record.restartPolicy.when === "never") {
					return;
				}

				if (containerService.isCrashLooping(record)) {
					const windowMs = record.restartPolicy.crash.windowMs;
					const allowedCrashes = record.restartPolicy.crash.allowedCrashes;
					console.error(
						`[LifecycleService] Container ${event.containerName} is in crash loop ` +
							`(allowedCrashes: ${allowedCrashes} in ${(windowMs / 1000 / 60).toFixed(1)} min). ` +
							`NOT auto-restarting.`,
					);
					return;
				}

				const isFailure =
					event.type === "error" ||
					// Non-zero exits are failures
					(event.exitCode !== undefined && event.exitCode !== 0) ||
					// Signals are treated as failures when we wanted it running
					(event.type === "stopped" && event.reason !== "exit") ||
					// Unknown exit info: be conservative
					(event.type === "stopped" && event.exitCode === undefined);

				if (record.restartPolicy.when === "on_failure" && !isFailure) {
					console.log(
						`[LifecycleService] Container ${event.containerName} stopped without failure; ` +
							`restartPolicy=on_failure → NOT restarting.`,
					);
					return;
				}

				scheduleRestart(
					record,
					`restartPolicy.when: ${record.restartPolicy.when}`,
				);
			}),
	};
};
