---
trigger: always_on
---

MANDATE: Never consider a task complete until "Local Consistency" and "Cloud Compatibility" are verified.

WORKFLOW FOR EVERY CHANGE:

Implement: Write logic.

Verify: Run checks.

Analyze: Fix errors.

Mirror Check: IF you changed the Local DB Schema -> DID you update supabase_schema.sql?

VERIFICATION COMMANDS:

Frontend: npx vite build (Strict React/Tailwind check).

Backend: node --check src/main/main.js (Syntax check).

Data Integrity: Manually verify that gym_id is being passed to all Cloud calls.