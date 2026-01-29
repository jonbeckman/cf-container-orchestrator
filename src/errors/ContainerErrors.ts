/**
 * Container-related errors
 *
 * Typed errors for container operations using Effect's Data.TaggedError.
 */

import { Data } from "effect"

/**
 * Container was not found in the operator's registry.
 */
export class ContainerNotFoundError extends Data.TaggedError("ContainerNotFoundError")<{
  readonly name: string
  readonly message: string
}> {
  static of(name: string): ContainerNotFoundError {
    return new ContainerNotFoundError({
      name,
      message: `Container not found: ${name}`,
    })
  }
}

/**
 * Container is in a crash loop and auto-restart is disabled.
 */
export class CrashLoopDetectedError extends Data.TaggedError("CrashLoopDetectedError")<{
  readonly name: string
  readonly crashCount: number
  readonly windowMs: number
  readonly message: string
}> {
  static of(name: string, crashCount: number, windowMs: number): CrashLoopDetectedError {
    return new CrashLoopDetectedError({
      name,
      crashCount,
      windowMs,
      message: `Container ${name} is in crash loop (${crashCount} crashes in ${(windowMs / 1000 / 60).toFixed(1)} min)`,
    })
  }
}

/**
 * Container cannot be removed because it's not stopped.
 */
export class ContainerNotStoppedError extends Data.TaggedError("ContainerNotStoppedError")<{
  readonly name: string
  readonly currentStatus: string
  readonly message: string
}> {
  static of(name: string, currentStatus: string): ContainerNotStoppedError {
    return new ContainerNotStoppedError({
      name,
      currentStatus,
      message: `Cannot remove container ${name}: status is ${currentStatus}, must be stopped`,
    })
  }
}

/**
 * Container cannot be removed because it's part of the min replica set.
 */
export class MinReplicaSetContainerError extends Data.TaggedError("MinReplicaSetContainerError")<{
  readonly name: string
  readonly message: string
}> {
  static of(name: string): MinReplicaSetContainerError {
    return new MinReplicaSetContainerError({
      name,
      message: `Cannot remove min replica set container: ${name}`,
    })
  }
}

/**
 * Ad-hoc containers are not allowed by the operator configuration.
 */
export class AdHocContainerNotAllowedError extends Data.TaggedError(
  "AdHocContainerNotAllowedError",
)<{
  readonly name: string
  readonly message: string
}> {
  static of(name: string): AdHocContainerNotAllowedError {
    return new AdHocContainerNotAllowedError({
      name,
      message: `Ad-hoc containers not allowed. Container ${name} is not in min replica set.`,
    })
  }
}

/**
 * Container start failed.
 */
export class ContainerStartError extends Data.TaggedError("ContainerStartError")<{
  readonly name: string
  readonly cause: unknown
  readonly message: string
}> {
  static of(name: string, cause: unknown): ContainerStartError {
    return new ContainerStartError({
      name,
      cause,
      message: `Failed to start container ${name}: ${String(cause)}`,
    })
  }
}

/**
 * Container stop failed.
 */
export class ContainerStopError extends Data.TaggedError("ContainerStopError")<{
  readonly name: string
  readonly cause: unknown
  readonly message: string
}> {
  static of(name: string, cause: unknown): ContainerStopError {
    return new ContainerStopError({
      name,
      cause,
      message: `Failed to stop container ${name}: ${String(cause)}`,
    })
  }
}

/**
 * Union of all container errors.
 */
export type ContainerError =
  | ContainerNotFoundError
  | CrashLoopDetectedError
  | ContainerNotStoppedError
  | MinReplicaSetContainerError
  | AdHocContainerNotAllowedError
  | ContainerStartError
  | ContainerStopError
