# Theta Architecture Documentation

## Purpose

This folder contains the governing architecture documentation for the Theta foundation restructure.

## Current Architecture

Theta is a static browser application with a legacy index-centered shell and newer split JavaScript modules.

## Target Architecture

Theta will migrate toward:

- App shell
- Central store
- Service layer
- Domain modules
- UI components
- Static build/deployment layer

## Migration Strategy

Theta will use the strangler pattern.

The current UI structure remains stable while runtime behavior is moved behind controlled modules, services, and state boundaries.

## Primary Roadmap

See:

- `theta-foundation-restructure-roadmap.html`
- `theta-foundation-restructure-roadmap-binder-edition.html`

## ADR References

Architecture decisions are stored in:

- `docs/adr/`
