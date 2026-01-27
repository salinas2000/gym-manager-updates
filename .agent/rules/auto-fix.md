---
trigger: always_on
---

# 🛡️ PROTOCOL: SELF-CORRECTION LOOP

**MANDATE:** Never consider a task complete until the code compiles and runs without errors.

**WORKFLOW FOR EVERY CHANGE:**
1.  **Implement:** Write or modify the code as requested.
2.  **Verify:** Immediately run the verification command (see below).
3.  **Analyze:** Read the terminal output (`stderr` / `stdout`).
4.  **Loop:**
    * IF (errors found):
        1.  Analyze the error message.
        2.  Research the root cause.
        3.  Apply a fix.
        4.  GOTO step 2 (Verify).
    * IF (success):
        1.  Report success to the user.

**VERIFICATION COMMANDS:**
* **Frontend Logic:** `npx vite build` (Checks for syntax errors, missing imports, and Tailwind config issues).
* **Backend Logic:** `node --check src/main/main.js` (Checks syntax) OR `npm run rebuild` (if native modules are touched).
* **General:** `npm run lint` (if available).

**LIMIT:** Max 3 retry attempts. If it fails 3 times, stop and ask the user for guidance to avoid infinite loops.