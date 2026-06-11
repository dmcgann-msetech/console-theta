# ADR-002: Use a Custom EventTarget Store

## Status

Accepted

## Context

Theta needs centralized state management, but adopting a framework store would add unnecessary migration risk.

## Decision

Use a lightweight custom EventTarget-based store for shared application state.

## Consequences

State changes become observable and testable without introducing React, Vue, Redux, or external framework dependencies.
