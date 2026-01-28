# Example: Service Orchestrator

This example demonstrates a complete setup of a Service Orchestrator managing a fleet of API services.

## Overview

The application consists of:
1. **ServiceOperator**: The central manager that maintains the fleet state.
2. **APIService**: The actual container/service running business logic (Durable Object).
3. **Worker**: The HTTP interface to interact with the orchestrator.

## Key Concepts Demonstrated

- **Baseline Fleet**: We define 3 services (`core-processor-1`, `core-processor-2`, `backup-processor`) that should *always* be running.
- **Config Overrides**: Each service in the fleet uses `DEFAULT_SERVICE_CONFIG` but overrides specific fields (like `logLevel` or `mode`).
- **Env Var Mapping**: The `envVarsBuilder` function transforms the typed config object into Environment Variables that the container receives.
- **Ad-Hoc Containers**: The API allows starting new, dynamic containers (e.g., `GET /start/temp-worker`) that aren't in the baseline fleet.

## Project Structure

- `src/container.ts`: Implementation of the `ManagedContainer`. Handles start/stop lifecycles and business logic.
- `src/operator.ts`: Implementation of the `ContainerOperator`. Defines the fleet config and restart policies.
- `src/types.ts`: Shared configuration interfaces.
- `src/worker.ts`: Worker entrypoint exposing HTTP endpoints.
- `wrangler.toml`: Cloudflare configuration file.

## Usage

### Prerequisites
- Configured `wrangler.toml` (included)
- `@jonbeckman/cf-container-orchestrator` installed

### Running the Example

1. **Deploy**:
   ```bash
   wrangler deploy
   ```

2. **Interact with the API**:

   *   **List Services**:
       ```bash
       curl https://<your-worker>.workers.dev/services
       ```
       *Expected Output*: Should show `core-processor-1`, `core-processor-2`, and `backup-processor` as "Running" (once the operator reconciles).

  *   **Start a Dynamic Service**:
      ```bash
      # Simple start
      curl https://<your-worker>.workers.dev/start/on-demand-1

      # Start with custom config
      curl -X POST https://<your-worker>.workers.dev/start/on-demand-2 \
        -H "Content-Type: application/json" \
        -d '{"logLevel": "debug", "maxConnections": 50}'
      ```

   *   **Stop a Service**:
       ```bash
       curl https://<your-worker>.workers.dev/stop/core-processor-1
       ```
       *Note*: Since `core-processor-1` is in the **baseline fleet**, the operator will automatically restart it in the next reconciliation cycle (30s).

   *   **Force Reconciliation**:
       ```bash
       curl -X POST https://<your-worker>.workers.dev/reconcile
       ```

## Code Highlights

### Configuration Overrides (`src/operator.ts`)

```typescript
const baselineFleet: ContainerSpec[] = [
  {
    name: "core-processor-1",
    config: {
      serviceName: "core-processor-1",
      // Uses defaults: mode="active", logLevel="info"
    }
  },
  {
    name: "backup-processor",
    config: {
      serviceName: "backup-processor",
      mode: "passive", // Override default mode
      logLevel: "warn",
    }
  }
]
```
