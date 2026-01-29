# Contributing to cf-container-orchestrator

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/cf-container-orchestrator.git
   cd cf-container-orchestrator
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development

### Prerequisites

- Node.js >= 24.13.0
- pnpm >= 10.0.0

### Available Scripts

- `pnpm build` - Build the project
- `pnpm typecheck` - Type check without building
- `pnpm lint` - Run linter
- `pnpm lint:fix` - Fix linting issues
- `pnpm format` - Check code formatting
- `pnpm format:fix` - Fix code formatting

### Code Style

- We use [oxfmt](https://github.com/oxc-project/oxc) for formatting
- We use [oxlint](https://github.com/oxc-project/oxc) for linting
- Code should follow TypeScript best practices
- Use Effect-TS patterns for error handling

### Type Safety

- All code must pass TypeScript strict mode
- Use proper types, avoid `any` unless absolutely necessary
- Export types that users might need

## Making Changes

### Code Structure

- Source code lives in `src/`
- Examples live in `example/`
- Keep related functionality together
- Use clear, descriptive names

### Documentation

- Add JSDoc comments for public APIs
- Include examples in documentation
- Update README.md if adding new features
- Update CHANGELOG.md for user-facing changes

### Testing

- Add tests for new features (when test infrastructure is added)
- Ensure existing functionality still works
- Test edge cases and error conditions

## Submitting Changes

### Commit Messages

- Use clear, descriptive commit messages
- Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `refactor:` for code refactoring
  - `test:` for test changes
  - `chore:` for maintenance tasks

### Pull Requests

1. **Update documentation** if needed
2. **Ensure all checks pass** (build, lint, format, typecheck)
3. **Write a clear PR description** explaining:
   - What changes you made
   - Why you made them
   - How to test the changes
4. **Link any related issues**
5. **Keep PRs focused** - one feature or fix per PR

### PR Review Process

- All PRs require review before merging
- Address review feedback promptly
- Keep discussions constructive and respectful

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- Description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node version, pnpm version, etc.)
- Relevant code snippets or error messages

### Feature Requests

For feature requests, please include:

- Description of the feature
- Use case or motivation
- Proposed implementation (if you have ideas)
- Any alternatives considered

## Questions?

Feel free to open an issue for questions or discussions. We're happy to help!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
