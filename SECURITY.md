# Security policy

This repo contains an educational research API, not a production multi-tenant service. There is no authentication layer. The upload endpoint processes user-provided files in memory, with a 4 MiB request limit and numeric shape validation. It must not be exposed publicly without rate limiting, TLS, deployment hardening and resource limits.

Please report security concerns privately through GitHub's repository security reporting feature (if enabled), rather than opening a public issue containing an exploit. Do not upload proprietary vehicle data, personal information, credentials, or licensed dataset archives to issues or PRs.
