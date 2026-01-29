# 1.0.0 (2026-01-29)


### Bug Fixes

* updated dependencies. Refined example and docs. ([f7a8ae0](https://github.com/jonbeckman/cf-container-orchestrator/commit/f7a8ae0ca3b8be3f55fda2cb03c4ddea5b03e50b))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-28

### Added

- Initial release of cf-container-orchestrator
- Min replica set management with automatic reconciliation
- Restart policies (`always`, `on_failure`, `never`)
- Crash loop detection and protection
- Lifecycle event handling (start/stop/error)
- Effect-TS based typed errors and services
- Complete example demonstrating fleet orchestration
- Comprehensive API documentation

### Features

- `createContainerOperator` factory function for creating operator classes
- `ManagedContainer` base class for container Durable Objects
- Configurable restart policies with crash loop protection
- Automatic reconciliation via Durable Object alarms
- Support for ad-hoc containers (configurable)
- Type-safe error handling with Effect-TS
