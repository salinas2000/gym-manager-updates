// ─── Plans / entitlements ────────────────────────────────────────────────────
// One codebase, features toggled per gym by its plan (+ optional per-gym
// overrides in licenses.features). Change a gym's plan from the master panel
// and it applies on the next license renewal (~10 min via the heartbeat).

export const PLAN_FEATURES = {
    basic:   { classes: false, trainers: false, rm: false, mobile_app: false, analytics: false },
    pro:     { classes: true,  trainers: true,  rm: true,  mobile_app: true,  analytics: false },
    premium: { classes: true,  trainers: true,  rm: true,  mobile_app: true,  analytics: true },
};

export const PLAN_LABELS = { basic: 'Básico', pro: 'Pro', premium: 'Premium' };
export const PLAN_ORDER = ['basic', 'pro', 'premium'];

/**
 * Is `feature` enabled for a gym on `plan` with optional per-gym `features`
 * overrides? Unknown/missing plan → everything ON (backward compatible, so
 * existing installs never lose a module).
 */
export function can(plan, features, feature) {
    const base = PLAN_FEATURES[plan];
    if (!base) return true;
    if (features && typeof features === 'object' && feature in features) return !!features[feature];
    return !!base[feature];
}
