# Módulos y roles — diseño

Estado: **F1 y F2 implementadas** (catálogo + enforcement en IPC). F3–F6 pendientes.

Implementación: [`src/main/config/modules.js`](../src/main/config/modules.js) es la
fuente de verdad; [`modules.test.js`](../src/main/config/modules.test.js) la
protege (incluido el test de completitud del gating IPC).

## Principio: dos ejes ortogonales

```
MÓDULO  = qué compró el gimnasio    → plan de la licencia
PERMISO = qué puede hacer la persona → rol del usuario

puede = módulo_activo AND rol_lo_permite
```

Mantenerlos separados es lo que permite añadir un módulo sin tocar roles, y un
rol sin tocar módulos. Todo sale de un único catálogo declarativo; nunca de
condicionales sueltas por el código.

---

## 1. Catálogo de módulos

Mapeo de cada área real de la app a un módulo.

| Módulo | Qué incluye (vistas de `App.jsx`) | Vendible |
|---|---|---|
| `customers` | Socios, fichas, altas, membresías, importadores | ❌ núcleo |
| `finance` | Pagos, tarifas, cobros | ❌ núcleo |
| `training` | Centro de entrenamiento, rutinas, plantillas, biblioteca, historial, prioridades | ✅ |
| `classes` | Clases, horarios, reservas | ✅ |
| `trainers` | Plantilla de entrenadores y sus horarios | ✅ |
| `inventory` | Almacén / stock | ✅ |
| `mobile_app` | App de socios (PWA) | ✅ |
| `rm` | Revisión de RM enviados desde el móvil | ✅ (requiere `mobile_app`) |
| `displays` | Panel de TV del gimnasio | ✅ |
| `analytics` | Analítica de negocio | ✅ |

Fuera del catálogo (siempre disponibles, no son módulos): `dashboard`,
`settings`, `backup`, `help`, y `admin` (que se rige por `is_master`).

### Novedades respecto a hoy

Hoy existen 5 flags: `classes`, `trainers`, `rm`, `mobile_app`, `analytics`.

Se añaden **4**: `training`, `inventory`, `displays`, y `customers`/`finance`
como núcleo explícito. Sin `training` e `inventory` no es posible vender un plan
"solo CRM", que es el caso de uso que motiva todo esto.

### Forma del catálogo

```js
// src/shared/catalog.js — fuente de verdad única (main + renderer + espejo móvil)

export const MODULES = {
  customers:  { label: 'Socios',            core: true },
  finance:    { label: 'Pagos y tarifas',   core: true },
  training:   { label: 'Entrenamiento',     since: '2.4.0' },
  classes:    { label: 'Clases y reservas' },
  trainers:   { label: 'Entrenadores' },
  inventory:  { label: 'Almacén',           since: '2.4.0' },
  mobile_app: { label: 'App de socios' },
  rm:         { label: 'Revisión de RM',    requires: ['mobile_app'] },
  displays:   { label: 'Pantallas TV',      since: '2.4.0' },
  analytics:  { label: 'Analítica' },
};
```

Tres metadatos que dan robustez:

- **`core: true`** — no se puede desactivar nunca, ni por plan ni por override.
  Protege contra vender por error un gimnasio sin socios ni pagos.
- **`requires: [...]`** — dependencias. `rm` no tiene sentido sin `mobile_app`
  (los RM se envían desde el móvil). `can()` las resuelve sola.
- **`since`** — versión en la que se introdujo el módulo. Base de la regla de
  compatibilidad (abajo).

---

## 2. Planes

```js
export const PLANS = {
  crm:     { label: 'CRM',     modules: ['customers','finance'] },
  basic:   { label: 'Básico',  modules: ['customers','finance','training','inventory','displays'] },
  pro:     { label: 'Pro',     modules: ['customers','finance','training','inventory','displays',
                                         'classes','trainers','mobile_app','rm'] },
  premium: { label: 'Premium', modules: '*' },
};
```

`crm` es nuevo: el plan barato que solo gestiona socios y cobros, sin app ni
entrenamiento. Es exactamente el caso "quiero solo el CRM".

Los overrides por gimnasio (`licenses.features`) siguen funcionando igual y
mandan sobre el plan — salvo en los módulos `core`.

---

## 3. Regla de oro: nadie pierde nada

**Un módulo nuevo nunca puede apagar algo que un gimnasio ya usaba.**

Por eso `training`, `inventory` y `displays` entran como **activos en todos los
planes que ya existían** (`basic`, `pro`, `premium`). Solo el plan **nuevo**
(`crm`) los tiene apagados. Consecuencia: ningún gimnasio actual nota el cambio,
independientemente del plan que tenga hoy — no hace falta ni saberlo.

Formalizado, para futuras ampliaciones:

> Al añadir un módulo, se marca `since: <versión>` y se activa en todos los
> planes preexistentes. Solo los planes creados a partir de esa versión pueden
> tenerlo desactivado.

### Fallback: `basic` ya era restrictivo

`basic` hoy tiene `classes`, `trainers`, `rm` y `mobile_app` en `false`. Se
respeta tal cual. Los módulos nuevos se le añaden en `true` porque hoy los tiene
(no estaban gateados).

---

## 4. Roles (fase posterior)

Se apoyan en el mismo catálogo. Cada permiso declara a qué módulo pertenece, así
el `AND` de los dos ejes lo resuelve `can()` y nunca se escribe a mano.

```js
export const PERMISSIONS = {
  'customers.view':   { module: 'customers' },
  'customers.create': { module: 'customers' },
  'customers.delete': { module: 'customers' },
  'payments.view':    { module: 'finance' },
  'payments.create':  { module: 'finance' },
  'tariffs.manage':   { module: 'finance' },
  // …
};

export const ROLES = {
  owner:     { label: 'Dueño',      permissions: '*' },
  manager:   { label: 'Gerente',    permissions: [/* todo menos licencia y plan */] },
  reception: { label: 'Recepción',  permissions: ['customers.view','payments.view',
                                                  'payments.create','bookings.manage'] },
  trainer:   { label: 'Entrenador', permissions: [/* … */], scope: 'assigned' },
};
```

Como `ROLES` son datos, los roles a medida (guardados en BD con la misma forma)
no requieren tocar `can()`.

### Dos reglas de fallo opuestas — importante

| Eje | Si hay duda | Por qué |
|---|---|---|
| Módulo (plan) | **Permitir** | Compatibilidad: un fallo de red no debe dejar sin app a un cliente que pagó |
| Permiso (rol) | **Denegar** | Seguridad: un empleado sí es un adversario realista |

---

## 5. Dónde se aplica (enforcement)

El gating actual es **cosmético**: esconde items del menú lateral y poco más.
`App.jsx` resuelve `case 'classes'` sin comprobar el plan, y no hay ninguna
guarda en `src/main`, IPC ni servicios.

El punto de estrangulamiento natural es el **IPC**: todo lo que hace el renderer
pasa por ahí.

```js
// handlers.js
const GUARDED = {
  'customers:create': 'customers.create',
  'customers:delete': 'customers.delete',
  'payments:create':  'payments.create',
  // …
};
ipcMain.handle(channel, withPermission(GUARDED[channel], handler));
```

Y la pieza que lo mantiene sano con el tiempo — un test que **falla si se
registra un canal IPC sin declarar su permiso**:

```js
test('todo canal IPC declara permiso', () => {
  expect(canalesRegistrados.filter(c => !(c in GUARDED))).toEqual([]);
});
```

Con el CI ya montado, olvidarse de un permiso deja de ser un fallo silencioso.

En el móvil, `PlanGuard` es un guard de React: bloquea la pantalla, no los datos.
Para módulos comerciales es aceptable; si algún módulo llega a proteger datos
sensibles, hará falta RLS.

---

## 6. Deuda conocida a arreglar de paso

1. `analytics` está declarado y vendido en Premium pero **no se usa en ningún
   sitio**.
2. `licenses.features` (overrides por gimnasio) **no tiene UI**: `setPlan` solo
   escribe `plan`. Se editan a mano en Supabase.
3. Incompatibilidad del fallback: `entitlements.js:22` documenta "plan
   desconocido → todo ON", pero `GymContext.jsx:51` y `:158` hacen
   `lic.plan || 'pro'`, que es un plan *conocido* y deja `analytics` en OFF.
4. `licenses.plan` y `licenses.features` **no están en migraciones versionadas**
   (creadas a mano en Supabase).

---

## 7. Fases

| Fase | Qué | Visible |
|---|---|---|
| ✅ F1 | Catálogo + `resolveModules()` con `core`/`requires` + cablear módulos nuevos | ❌ nada cambia |
| ✅ F2 | Enforcement en IPC + test de completitud | ❌ |
| F3 | UI de overrides por gimnasio en el Panel Maestro | ✅ vendible |
| F4 | Usuarios locales + login + roles | ✅ opt-in |
| F5 | UI de empleados en Ajustes | ✅ |
| F6 | Roles personalizados | ✅ |

F1–F3 desbloquean vender "solo CRM". F4–F6 desbloquean gimnasios con empleados.
