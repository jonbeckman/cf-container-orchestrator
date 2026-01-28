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

## Quick Start

### 1. Create Your Container

Extend `ManagedContainer` to create your container Durable Object:

```typescript
import { ManagedContainer, type ManagedContainerConfig } from "@jonbeckman/cf-container-orchestrator"
import type { StopParams } from "@cloudflare/containers"

interface MyContainerEnv {
  CONTAINER_OPERATOR: DurableObjectNamespace<any>
  MY_CONTAINER: DurableObjectNamespace<MyContainer>
  API_KEY: string
}

export class MyContainer extends ManagedContainer<MyContainerEnv> {
  defaultPort = 8080
  sleepAfter = "30m"

  // Configure container name extraction
  protected override getManagedContainerConfig(): ManagedContainerConfig {
    return {
      containerNameEnvKey: "CONTAINER_NAME",
      operatorName: "global",
    }
  }

  // Optional: Custom lifecycle hooks
  protected override async onContainerStart(): Promise<void> {
    console.log("Container started!")
  }

  protected override async onContainerStop(params: StopParams): Promise<void> {
    console.log(`Container stopped with exit code: ${params.exitCode}`)
  }
}
```

### 2. Create Your Operator

Use `createContainerOperator` to create an operator configured for your containers:

```typescript
import {
  createContainerOperator,
  type ContainerOperatorEnv,
  type ContainerSpec,
  defaultRestartPolicy,
} from "@jonbeckman/cf-container-orchestrator"

interface MyContainerConfig {
  strategy: string
}

interface MyOperatorEnv extends ContainerOperatorEnv {
  MY_CONTAINER: DurableObjectNamespace<MyContainer>
  API_KEY: string
}

// Define your baseline fleet
const baselineFleet: ContainerSpec[] = [
  {
    name: "default",
    config: { strategy: "MyStrategy" } satisfies MyContainerConfig,
    restartPolicy: defaultRestartPolicy(),
  },
]

// Build environment variables for containers
const envVarsBuilder = (spec: ContainerSpec, env: MyOperatorEnv) => {
  const config = spec.config as unknown as MyContainerConfig
  return {
    STRATEGY: config.strategy,
    API_KEY: env.API_KEY,
  }
}

// Create the operator class
export const MyContainerOperator = createContainerOperator<MyOperatorEnv>({
  baselineFleet,
  envVarsBuilder,
  containerNameEnvKey: "CONTAINER_NAME",
  reconcileIntervalMs: 60_000, // Reconcile every minute
  allowAdHocContainers: true,
})
```

### 3. Configure Wrangler

Add the Durable Objects to your `wrangler.toml`:

```toml
[durable_objects]
bindings = [
  { name = "MY_CONTAINER", class_name = "MyContainer" },
  { name = "CONTAINER_OPERATOR", class_name = "MyContainerOperator" },
  { name = "MANAGED_CONTAINER", class_name = "MyContainer" }
]
```

### 4. Use the Operator

Call operator methods via RPC:

```typescript
// In your Worker
export default {
  async fetch(request: Request, env: Env) {
    const operatorId = env.CONTAINER_OPERATOR.idFromName("global")
    const operator = env.CONTAINER_OPERATOR.get(operatorId)

    // Start a container
    await operator.startContainer({
      name: "my-container",
      config: { strategy: "MyStrategy" },
    })

    // List all containers
    const containers = await operator.listContainers()

    // Stop a container
    await operator.stopContainer("my-container")

    return new Response(JSON.stringify(containers))
  }
}
```

## API Reference

### ManagedContainer

Base class for containers managed by the operator.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `defaultPort` | `number` | Port the container listens on |
| `sleepAfter` | `string` | Duration before container sleep (e.g., "30m") |

#### Methods

| Method | Description |
|--------|-------------|
| `getManagedContainerConfig()` | Override to configure container behavior |
| `onContainerStart()` | Called when container starts |
| `onContainerStop(params)` | Called when container stops |
| `onContainerError(error)` | Called when container errors |
| `getManagedState()` | Get extended state with uptime info |

### createContainerOperator

Factory function to create an operator class.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baselineFleet` | `ContainerSpec[]` | `[]` | Containers to auto-manage |
| `envVarsBuilder` | `(spec, env) => Record<string, string>` | Required | Builds env vars for containers |
| `containerNameEnvKey` | `string` | `"CONTAINER_NAME"` | Env var key for container name |
| `reconcileIntervalMs` | `number` | `60000` | Reconciliation interval (0 to disable) |
| `allowAdHocContainers` | `boolean` | `true` | Allow non-baseline containers |

### Operator Methods

| Method | Description |
|--------|-------------|
| `startContainer(config, force?)` | Start a container |
| `stopContainer(name)` | Stop a container |
| `getContainerInfo(name)` | Get info for a container |
| `listContainers()` | List all containers |
| `removeContainer(name)` | Remove a stopped container |
| `clearCrashHistory(name)` | Clear crash history |
| `reconcile()` | Manually trigger reconciliation |

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

## License

MIT
