# Security

## Reporting

Do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting on this repository, or email the address on [qadan.co](https://qadan.co/).

Include the affected version, a minimal reproduction, and the impact. Do not include live credentials or personal data.

## Scope

This package makes outbound requests to three public government APIs. It does not ship credentials, write data, or execute remote code. The main risks are:

- A malicious or compromised upstream response causing unsafe rendering in a consuming application.
- Cache poisoning if a consumer injects an untrusted cache backend.
- Rate-limit exhaustion from uncached use.

## Supported versions

Pre-1.0. Security fixes land on the latest released minor.
