# Pyrelane Security and Commercialization Roadmap

## Purpose
Protect Pyrelane as a future commercial SaaS asset by separating public frontend code from protected business logic, data access, secrets, tenant controls, and privileged workflows.

## Core Rule
Frontend code cannot be treated as secret. Anything sent to the browser can be inspected. Pyrelane must protect value through architecture, not obscurity.

## Required Future Architecture
- Private source control for commercial implementation
- Build pipeline using bundled/minified frontend assets
- No service-role keys or privileged secrets in browser code
- Supabase Row Level Security enforced by tenant/user role
- Separate Supabase environments for production, staging, and Theta
- Cloudflare Worker/API layer for privileged operations
- Environment variables for deploy-specific configuration
- Audit logging for authentication, data access, changes, and admin actions
- Tenant isolation before customer onboarding
- Separate demo/sample data environment
- Deployment separation between production and experimental branches

## Frontend Exposure Policy
Acceptable in browser:
- HTML shell
- CSS
- compiled/minified JavaScript
- public-safe Supabase anon key
- static assets

Never expose in browser:
- Supabase service role key
- API secrets
- private tokens
- billing logic
- privileged automation logic
- customer data exports
- cross-tenant access logic
- internal admin override logic

## Theta Policy
Theta remains an experimental sandbox. No production secrets, customer data, or commercial-only backend logic may be introduced into Theta until dedicated infrastructure exists.

## Future Required Work
1. Create dedicated Theta Supabase project.
2. Create dedicated production Supabase project.
3. Create dedicated staging Supabase project.
4. Add Cloudflare Worker API boundary.
5. Move privileged operations out of browser JavaScript.
6. Add build tooling and minification.
7. Review all frontend code for exposed secrets.
8. Add RLS validation checklist.
9. Add tenant isolation model.
10. Add commercial deployment checklist.

