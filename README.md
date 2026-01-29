# cf-container-orchestrator

A generic Cloudflare Containers operator with fleet management, restart policies, and crash loop protection. Built with [Effect-TS](https://effect.website).

## Features

- **Baseline Fleet Management**: Define containers that should always be running, with automatic reconciliation
- **Restart Policies**: Configure when containers should restart (`always`, `on_failure`, `never`)
- **Crash Loop Protection**: Automatically detect and prevent crash loops
- **Lifecycle Events**: Containers report start/stop/error events to the operator

## Installation

```bash
pnpm add @jonbeckman/cf-container-orchestrator
```

## Use Case

I built this for my own use case of running a replication set of services, each with their own configuration and lifecycle management requirements.

In practice, that means:

- High Availability: Enforcing a "baseline fleet" of services that must always be running (with automatic restarts and crash-loop protection).
- Dynamic Configuration: Injecting specific secrets and configuration into each container instance at runtime.
- Lifecycle Management: Starting, stopping, and restarting containers as needed. I wrapped this into an API to call remotely.

For a complete guide on how to integrate and use the library, check out the [Example Guide](./example/README.md).

## API Reference

### ManagedContainer

Base class for containers managed by the operator.

#### Properties

| Property      | Type     | Description                                   |
| ------------- | -------- | --------------------------------------------- |
| `defaultPort` | `number` | Port the container listens on                 |
| `sleepAfter`  | `string` | Duration before container sleep (e.g., "30m") |

#### Methods

| Method                        | Description                              |
| ----------------------------- | ---------------------------------------- |
| `getManagedContainerConfig()` | Override to configure container behavior |
| `onContainerStart()`          | Called when container starts             |
| `onContainerStop(params)`     | Called when container stops              |
| `onContainerError(error)`     | Called when container errors             |
| `getManagedState()`           | Get extended state with uptime info      |

### createContainerOperator

Factory function to create an operator class.

#### Options

| Option                 | Type                                    | Default            | Description                            |
| ---------------------- | --------------------------------------- | ------------------ | -------------------------------------- |
| `baselineFleet`        | `ContainerSpec[]`                       | `[]`               | Containers to auto-manage              |
| `envVarsBuilder`       | `(spec, env) => Record<string, string>` | Required           | Builds env vars for containers         |
| `containerNameEnvKey`  | `string`                                | `"CONTAINER_NAME"` | Env var key for container name         |
| `reconcileIntervalMs`  | `number`                                | `60000`            | Reconciliation interval (0 to disable) |
| `allowAdHocContainers` | `boolean`                               | `true`             | Allow non-baseline containers          |

### Operator Methods

| Method                           | Description                     |
| -------------------------------- | ------------------------------- |
| `startContainer(config, force?)` | Start a container               |
| `stopContainer(name)`            | Stop a container                |
| `getContainerInfo(name)`         | Get info for a container        |
| `listContainers()`               | List all containers             |
| `removeContainer(name)`          | Remove a stopped container      |
| `clearCrashHistory(name)`        | Clear crash history             |
| `reconcile()`                    | Manually trigger reconciliation |

## Restart Policies

### `defaultRestartPolicy()`

Restarts on failure with crash loop protection:

- Restart when: `on_failure`
- Crash window: 10 minutes
- Allowed crashes: 3

### `alwaysRestartPolicy()`

Always restart, with crash loop protection.

### `neverRestartPolicy()`

Never restart automatically.

### Custom Policy

```typescript
const customPolicy: RestartPolicy = {
  when: "on_failure",
  crash: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    allowedCrashes: 5,
  },
}
```

## Error Handling

The package exports typed errors for handling specific failure cases:

```typescript
import {
  ContainerNotFoundError,
  CrashLoopDetectedError,
  ContainerNotStoppedError,
  BaselineContainerError,
} from "@jonbeckman/cf-container-orchestrator"

// Errors have static factory methods
const error = ContainerNotFoundError.of("my-container")
console.log(error.message) // "Container not found: my-container"
```

## Roadmap

- [ ] Built-in API
- [ ] Built-in UI
- [ ] Add configuration for individual container
  - [ ] health check
  - [ ] region placement
  - [ ] compute resources
- [ ] Support custom rollout strategies
  - Currently not possible as Cloudflare controls the rollout via the API, not via Container or Durable Object SDK
- [ ] Typed exits codes

## Development

First, install the dependencies:

```bash
pnpm install
```

### Local CI/CD

First, install the [act](https://github.com/nektos/act) CLI.

Then, run the CI/CD workflow locally:

```bash
unset GITHUB_TOKEN && act -j ci -s GITHUB_TOKEN="$(gh auth token)" --container-architecture linux/amd64
```

## License

MIT
