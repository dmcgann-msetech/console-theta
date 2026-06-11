# ADR-003: Establish a Service Layer Boundary

## Status

Accepted

## Context

Feature modules currently reach directly into shared globals and backend access patterns. This creates coupling and makes migration risky.

## Decision

Move Supabase access and domain operations behind service modules.

## Consequences

Feature modules will call services instead of directly managing backend behavior. This improves testability, reduces global coupling, and supports gradual strangler-pattern migration.
