# ADR-005: Encoding Governance

## Status

Accepted

## Context

Theta has already suffered mojibake and encoding corruption. Encoding must become repository policy, not manual cleanup.

## Decision

Enforce UTF-8 source files, line-ending normalization, and reviewable encoding controls through .editorconfig, .gitattributes, scanner tooling, and future validation gates.

## Consequences

Encoding drift is reduced. Mojibake repair becomes deterministic and reviewable. Files that fail validation must be fixed before migration work continues.
