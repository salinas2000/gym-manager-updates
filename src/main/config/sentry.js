// Sentry — monitorización de errores del proceso MAIN de Electron.
//
// El DSN no es un secreto: solo permite ENVIAR eventos, no leerlos, así que es
// seguro embeberlo en el cliente. Se puede sobreescribir con la env SENTRY_DSN_DESKTOP.
//
// Por defecto solo se activa en builds empaquetados (producción) para no llenar
// el panel de ruido de desarrollo. Para probarlo en local: SENTRY_FORCE=1.

const Sentry = require('@sentry/electron/main');

const DSN = process.env.SENTRY_DSN_DESKTOP
  || 'https://e9deeb0a67223af446ec7a81bd6aa585@o4511824029876224.ingest.de.sentry.io/4511824034594896';

let initialized = false;

function initSentry(app) {
  if (initialized) return;
  const enabled = (app && app.isPackaged) || process.env.SENTRY_FORCE === '1';
  if (!enabled) {
    console.log('[Sentry] desactivado (build de desarrollo)');
    return;
  }
  try {
    const version = (app && typeof app.getVersion === 'function') ? app.getVersion() : 'unknown';
    Sentry.init({
      dsn: DSN,
      release: `gym-desktop@${version}`,
      environment: (app && app.isPackaged) ? 'production' : 'development',
      // Solo errores; sin trazas de rendimiento (cuidar la cuota del plan free).
      tracesSampleRate: 0,
    });
    initialized = true;
    console.log(`[Sentry] inicializado (main) release gym-desktop@${version}`);
  } catch (e) {
    console.error('[Sentry] fallo al inicializar:', e);
  }
}

module.exports = { initSentry, Sentry };
