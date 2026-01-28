import {
  type ContainerOperatorEnv,
  type ContainerSpec,
  createContainerOperator,
  defaultRestartPolicy,
} from "@jonbeckman/cf-container-orchestrator"
import { DEFAULT_SERVICE_CONFIG, type ServiceConfig, type ServiceEnv } from "./types"

// Extend the base Operator Env with our bindings
interface OperatorEnv extends ContainerOperatorEnv, ServiceEnv {}

/**
 * Define the baseline fleet.
 * These containers will be automatically started and monitored.
 */
const baselineFleet: ContainerSpec[] = [
  // 1. Primary Service - Uses mostly defaults
  {
    name: "core-processor-1",
    config: {
      serviceName: "core-processor-1",
      // Inherits other defaults: logLevel="info" and maxConnections=100
    } satisfies Partial<ServiceConfig>,
    restartPolicy: defaultRestartPolicy(),
  },

  // 2. Secondary Service - Overrides logging config
  {
    name: "core-processor-2",
    config: {
      serviceName: "core-processor-2",
      logLevel: "debug", // More verbose logging
    } satisfies Partial<ServiceConfig>,
    restartPolicy: defaultRestartPolicy(),
  },

  // 3. Backup Service - Custom restart policy
  {
    name: "backup-processor",
    config: {
      serviceName: "backup-processor",
      logLevel: "warn",
    } satisfies Partial<ServiceConfig>,
    restartPolicy: {
      when: "on_failure",
      crash: {
        windowMs: 30_000,
        allowedCrashes: 5,
      },
    }
  },
]

/**
 * Map the configuration object to Environment Variables.
 * This is how config is passed to the Durable Objects.
 */
const envVarsBuilder = (spec: ContainerSpec, env: OperatorEnv) => {
  const config = { ...DEFAULT_SERVICE_CONFIG, ...(spec.config as Partial<ServiceConfig>) }
  
  return {
    // Config mapped to Env Vars
    SERVICE_NAME: spec.name,
    LOG_LEVEL: config.logLevel,
    MAX_CONNECTIONS: config.maxConnections.toString(),
    
    // Pass through shared secrets/bindings if needed
    API_SECRET: env.API_SECRET,
  }
}

/**
 * Create the Operator Class
 */
export const ServiceOperator = createContainerOperator<OperatorEnv>({
  baselineFleet,
  envVarsBuilder,
  containerNameEnvKey: "SERVICE_NAME",
  reconcileIntervalMs: 60_000, // Check fleet health every 60 seconds
  allowAdHocContainers: true,  // Allow starting temporary/dynamic containers via API
})
