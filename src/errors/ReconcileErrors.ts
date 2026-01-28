/**
 * Reconciliation-related errors
 *
 * Typed errors for fleet reconciliation operations.
 */

import { Data } from "effect";

/**
 * General reconciliation error.
 */
export class ReconcileError extends Data.TaggedError("ReconcileError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {
	static of(message: string, cause?: unknown): ReconcileError {
		return new ReconcileError({ message, cause });
	}
}

/**
 * Multiple containers failed during reconciliation.
 */
export class PartialReconcileError extends Data.TaggedError(
	"PartialReconcileError",
)<{
	readonly failedContainers: ReadonlyArray<{
		readonly name: string;
		readonly error: unknown;
	}>;
	readonly successCount: number;
	readonly message: string;
}> {
	static of(
		failedContainers: ReadonlyArray<{ name: string; error: unknown }>,
		successCount: number,
	): PartialReconcileError {
		return new PartialReconcileError({
			failedContainers,
			successCount,
			message: `Reconciliation partially failed: ${successCount} succeeded, ${failedContainers.length} failed`,
		});
	}
}

/**
 * Union of all reconcile errors.
 */
export type ReconcileErrorType = ReconcileError | PartialReconcileError;
