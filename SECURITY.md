# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **jonathantbeckman@gmail.com**

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

Please include the following information:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Disclosure Policy

When we receive a security bug report, we will assign it to a primary handler. This person will coordinate the fix and release process, involving the following steps:

1. Confirm the problem and determine the affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all releases still under maintenance
4. Release fixes as soon as possible

We follow a coordinated disclosure process:

- **Report received**: We acknowledge receipt within 48 hours
- **Initial assessment**: We assess the vulnerability within 7 days
- **Fix development**: We develop and test fixes
- **Release**: We release fixes in the next patch version
- **Public disclosure**: After fixes are released, we may publish a security advisory

## Security Best Practices

When using this library:

- **Keep dependencies updated**: Regularly update `@cloudflare/containers` and `effect` to their latest versions
- **Validate inputs**: Always validate and sanitize inputs before passing them to the operator
- **Secure secrets**: Never commit secrets or API keys to version control
- **Monitor containers**: Use the lifecycle events to monitor container health
- **Review restart policies**: Configure appropriate restart policies to prevent resource exhaustion

## Known Security Considerations

- **Container isolation**: This library orchestrates Cloudflare Containers. Security of the containers themselves is managed by Cloudflare's platform
- **Durable Object state**: Container state is persisted in Durable Object storage. Ensure proper access controls are in place
- **RPC calls**: Lifecycle events are sent via RPC between Durable Objects. Ensure your Worker has proper authentication/authorization

## Security Updates

Security updates will be released as patch versions (e.g., 0.1.0 → 0.1.1). We recommend:

- Pinning to a specific version in production
- Regularly checking for security updates
- Reviewing CHANGELOG.md for security-related changes

## Credits

We thank security researchers and users who report security vulnerabilities responsibly.
