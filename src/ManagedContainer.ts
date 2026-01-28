/**
 * ManagedContainer Base Class
 *
 * Abstract base class for containers managed by the ContainerOperator.
 * Extends @cloudflare/containers Container with:
 * - Automatic operator notification on lifecycle events
 * - Configurable container name extraction
 * - Startup/uptime tracking
 *
 * Users extend this class and configure:
 * - defaultPort
 * - sleepAfter
 * - optional: custom lifecycle hooks via onContainerStart/onContainerStop/onContainerError
 */

import type {
	ContainerStartConfigOptions,
	StopParams,
} from "@cloudflare/containers";
import { Container } from "@cloudflare/containers";
import type { ManagedContainerState } from "./types/ContainerState";
import { formatDuration } from "./types/ContainerState";
import type { LifecycleEvent, StopReason } from "./types/LifecycleEvent";

// ============================================================================
// Types for @cloudflare/containers (not exported)
// ============================================================================

/**
 * Cancellation options for startAndWaitForPorts().
 * These types are not exported from @cloudflare/containers.
 */
interface CancellationOptions {
	abort?: AbortSignal;
	instanceGetTimeoutMS?: number;
	portReadyTimeoutMS?: number;
	waitInterval?: number;
}

interface StartAndWaitForPortsOptions {
	startOptions?: ContainerStartConfigOptions;
	ports?: number | number[];
	cancellationOptions?: CancellationOptions;
}

interface WaitOptions {
	portToCheck: number;
	signal?: AbortSignal;
	retries?: number;
	waitInterval?: number;
}

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Minimum environment bindings required for ManagedContainer.
 * User's environment must extend this.
 */
export interface ManagedContainerEnv {
	/** DurableObject namespace for the operator */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	CONTAINER_OPERATOR: DurableObjectNamespace<any>;
}

/**
 * Interface for the operator stub (RPC calls).
 */
export interface OperatorStub {
	handleLifecycleEvent(event: LifecycleEvent): Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for ManagedContainer behavior.
 */
export interface ManagedContainerConfig {
	/**
	 * Environment variable key used to extract container name from start options.
	 * @default "CONTAINER_NAME"
	 */
	containerNameEnvKey?: string;

	/**
	 * Name used to get the operator DO (idFromName).
	 * @default "global"
	 */
	operatorName?: string;

	/**
	 * If true, keep the container alive when activity expires (operator manages lifecycle).
	 * If false, allow the container to sleep normally.
	 * @default true
	 */
	keepAlive?: boolean;
}

const DEFAULT_CONFIG: Required<ManagedContainerConfig> = {
	containerNameEnvKey: "CONTAINER_NAME",
	operatorName: "global",
	keepAlive: true,
};

// ============================================================================
// ManagedContainer Base Class
// ============================================================================

/**
 * Abstract base class for containers managed by the ContainerOperator.
 *
 * @example
 * ```typescript
 * export class MyContainer extends ManagedContainer<MyEnv> {
 *   defaultPort = 8080
 *   sleepAfter = "30m"
 *
 *   // Optional: custom logic on start
 *   protected async onContainerStart(): Promise<void> {
 *     console.log("My container started!")
 *   }
 * }
 * ```
 */
export abstract class ManagedContainer<
	TEnv extends ManagedContainerEnv,
> extends Container<TEnv> {
	/**
	 * Container startup timeouts (conservative for production).
	 * Override these in subclasses if needed.
	 */
	protected readonly CONTAINER_TIMEOUTS = {
		instanceGetTimeoutMS: 60_000,
		portReadyTimeoutMS: 90_000,
		waitIntervalMS: 1_000,
	} as const;

	/**
	 * Configuration for this container.
	 * Override in constructor or via getManagedContainerConfig().
	 */
	protected readonly managedConfig: Required<ManagedContainerConfig>;

	// Persisted timing state
	private startRequestedAt: number | null = null;
	private containerStartedAt: number | null = null;
	private containerName: string | null = null;

	constructor(ctx: DurableObjectState<object>, env: TEnv) {
		super(ctx, env);
		this.managedConfig = {
			...DEFAULT_CONFIG,
			...this.getManagedContainerConfig(),
		};

		// Load persisted timestamps from storage
		this.ctx.blockConcurrencyWhile(async () => {
			this.startRequestedAt =
				(await this.ctx.storage.get<number>("startRequestedAt")) ?? null;
			this.containerStartedAt =
				(await this.ctx.storage.get<number>("containerStartedAt")) ?? null;
			this.containerName =
				(await this.ctx.storage.get<string>("containerName")) ?? null;
		});
	}

	/**
	 * Override to provide custom configuration.
	 */
	protected getManagedContainerConfig(): ManagedContainerConfig {
		return {};
	}

	/**
	 * Override to run custom logic when container starts.
	 * Called after operator is notified.
	 */
	protected async onContainerStart(): Promise<void> {
		// Override in subclass
	}

	/**
	 * Override to run custom logic when container stops.
	 * Called after operator is notified.
	 */
	protected async onContainerStop(_params: StopParams): Promise<void> {
		// Override in subclass
	}

	/**
	 * Override to run custom logic when container errors.
	 * Called after operator is notified.
	 */
	protected onContainerError(_error: unknown): void {
		// Override in subclass
	}

	// ============================================================================
	// Private Helpers
	// ============================================================================

	private async captureContainerNameFromStartOptions(
		startOptions?: ContainerStartConfigOptions,
	): Promise<void> {
		const name =
			startOptions?.envVars?.[this.managedConfig.containerNameEnvKey];
		if (!name) return;
		if (this.containerName === name) return;

		this.containerName = name;
		await this.ctx.storage.put("containerName", name);
	}

	private getOperator(): OperatorStub {
		const ns = this.env.CONTAINER_OPERATOR as DurableObjectNamespace;
		const operatorId = ns.idFromName(this.managedConfig.operatorName);
		return ns.get(operatorId) as unknown as OperatorStub;
	}

	private async notifyOperator(
		type: "started" | "stopped" | "error",
		options?: {
			error?: string;
			exitCode?: number;
			reason?: StopReason;
		},
	): Promise<void> {
		if (!this.containerName) {
			console.warn(
				"[ManagedContainer] Cannot notify operator: container name not set",
			);
			return;
		}

		try {
			const operator = this.getOperator();
			await operator.handleLifecycleEvent({
				type,
				containerName: this.containerName,
				timestamp: Date.now(),
				error: options?.error,
				exitCode: options?.exitCode,
				reason: options?.reason,
			});
		} catch (err) {
			console.error("[ManagedContainer] Failed to notify operator:", err);
		}
	}

	// ============================================================================
	// Container Overrides
	// ============================================================================

	override async start(
		startOptions?: ContainerStartConfigOptions,
		waitOptions?: WaitOptions,
	): Promise<void> {
		this.startRequestedAt = Date.now();
		await this.ctx.storage.put("startRequestedAt", this.startRequestedAt);
		await this.captureContainerNameFromStartOptions(startOptions);

		console.log(
			`[ManagedContainer] start() called at ${new Date(this.startRequestedAt).toISOString()}`,
		);

		return super.start(startOptions, {
			...waitOptions,
			waitInterval: this.CONTAINER_TIMEOUTS.waitIntervalMS,
		} as WaitOptions);
	}

	override async startAndWaitForPorts(
		portsOrArgs?: number | number[] | StartAndWaitForPortsOptions,
		_cancellationOptions?: CancellationOptions,
		startOptions?: ContainerStartConfigOptions,
	): Promise<void> {
		this.startRequestedAt = Date.now();
		await this.ctx.storage.put("startRequestedAt", this.startRequestedAt);

		console.log(
			`[ManagedContainer] startAndWaitForPorts() called at ${new Date(this.startRequestedAt).toISOString()}`,
		);

		const timeouts: CancellationOptions = {
			instanceGetTimeoutMS: this.CONTAINER_TIMEOUTS.instanceGetTimeoutMS,
			portReadyTimeoutMS: this.CONTAINER_TIMEOUTS.portReadyTimeoutMS,
			waitInterval: this.CONTAINER_TIMEOUTS.waitIntervalMS,
		};

		// Handle object-style call signature
		if (
			portsOrArgs !== undefined &&
			typeof portsOrArgs === "object" &&
			!Array.isArray(portsOrArgs)
		) {
			const args = portsOrArgs as StartAndWaitForPortsOptions;
			await this.captureContainerNameFromStartOptions(args.startOptions);
			return super.startAndWaitForPorts({
				...args,
				cancellationOptions: timeouts,
			});
		}

		// Handle positional arguments call signature
		await this.captureContainerNameFromStartOptions(startOptions);
		return super.startAndWaitForPorts(
			portsOrArgs as number | number[] | undefined,
			timeouts,
			startOptions,
		);
	}

	/**
	 * Get extended state with timing information.
	 * Note: This returns ManagedContainerState which extends the base state.
	 */
	async getManagedState(): Promise<ManagedContainerState> {
		const baseState = await super.getState();

		const startupDurationMs =
			this.startRequestedAt && this.containerStartedAt
				? this.containerStartedAt - this.startRequestedAt
				: null;

		const uptimeMs = this.containerStartedAt
			? Date.now() - this.containerStartedAt
			: null;

		return {
			lastChange: baseState.lastChange,
			status: baseState.status,
			exitCode: "exitCode" in baseState ? baseState.exitCode : undefined,
			startupDurationMs,
			startupDuration:
				startupDurationMs !== null ? formatDuration(startupDurationMs) : null,
			uptimeMs,
			uptime: uptimeMs !== null ? formatDuration(uptimeMs) : null,
		};
	}

	// ============================================================================
	// Lifecycle Hooks
	// ============================================================================

	override async onStart(): Promise<void> {
		this.containerStartedAt = Date.now();
		await this.ctx.storage.put("containerStartedAt", this.containerStartedAt);

		const startupDurationMs = this.startRequestedAt
			? this.containerStartedAt - this.startRequestedAt
			: null;

		console.log(
			`[ManagedContainer] Container started at ${new Date(this.containerStartedAt).toISOString()}` +
				(startupDurationMs !== null
					? ` (startup took ${(startupDurationMs / 1000).toFixed(2)}s)`
					: ""),
		);

		// Notify operator first
		await this.notifyOperator("started");

		// Then run user's custom logic
		await this.onContainerStart();
	}

	override async onStop(stopParams: StopParams): Promise<void> {
		const stoppedAt = Date.now();
		const uptimeMs = this.containerStartedAt
			? stoppedAt - this.containerStartedAt
			: null;

		const isGraceful = stopParams.exitCode === 0;

		console.log(
			`[ManagedContainer] Container stopped at ${new Date(stoppedAt).toISOString()}` +
				(uptimeMs !== null
					? ` (was alive for ${formatDuration(uptimeMs)})`
					: "") +
				` - exitCode: ${stopParams.exitCode}, reason: ${stopParams.reason}` +
				(isGraceful ? " (graceful)" : ""),
		);

		// Notify operator first (before cleanup)
		await this.notifyOperator("stopped", {
			exitCode: stopParams.exitCode,
			reason: stopParams.reason,
		});

		// Run user's custom logic
		await this.onContainerStop(stopParams);

		// Reset timestamps for next lifecycle
		this.startRequestedAt = null;
		this.containerStartedAt = null;

		await Promise.all([
			this.ctx.storage.delete("startRequestedAt"),
			this.ctx.storage.delete("containerStartedAt"),
		]);
	}

	override onError(error: unknown): void {
		const errorString = String(error);

		// Detect version rollout - Cloudflare signals this via error message
		// We reclassify it as a "stopped" event with reason "version_rollout"
		const isVersionRollout = errorString.includes("new version rollout");

		if (isVersionRollout) {
			console.log(
				"[ManagedContainer] Container stopped due to version rollout",
			);
			this.ctx.waitUntil(
				this.notifyOperator("stopped", { reason: "version_rollout" }),
			);
		} else {
			console.error("[ManagedContainer] Container error:", error);
			this.ctx.waitUntil(this.notifyOperator("error", { error: errorString }));
		}

		// Run user's custom logic
		this.onContainerError(error);
	}

	override async onActivityExpired(): Promise<void> {
		if (this.managedConfig.keepAlive) {
			// Keep container alive - operator manages lifecycle
			console.log(
				"[ManagedContainer] onActivityExpired intercepted — keeping container alive",
			);
			return;
		}
		// Allow container to sleep normally
		await super.onActivityExpired();
	}
}
