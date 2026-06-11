# ADR-001: Use Vite as the Static App Build Foundation

## Status

Accepted

## Context

Theta is currently a static browser application with legacy single-file roots and newer split JavaScript modules. The project needs a build system without forcing a framework rewrite.

## Decision

Use Vite as the build foundation for local development, production bundling, and future static deployment.

## Consequences

Theta keeps its static hosting model while gaining repeatable builds, modern ESM handling, asset processing, and test integration.

React, Vue, Angular, Electron, and a full rewrite are rejected for this phase.
