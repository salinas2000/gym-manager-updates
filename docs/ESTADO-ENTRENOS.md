# Estado del editor de entrenos — 9 de septiembre de 2026

Documento de traspaso. Recoge qué se rompió, qué se arregló, qué reglas rigen
ahora y qué queda pendiente. Escrito para retomar el trabajo en otro equipo.

---

## 1. De dónde viene todo esto

El entrenador (Josema, gimnasio JosemaRos, 132 socios) reportó tres cosas:

1. **"Guardo un cambio y al volver no está."**
2. **"A un cliente le salen veinte ejercicios en un día."**
3. **"El día se queda en naranja y no se pone verde nunca."**

Los tres eran **el mismo fallo**. Al sustituir un ejercicio en un programa en
marcha, el sistema cierra el viejo la víspera y arranca el nuevo ese día. Pero:

- El **editor** filtraba por el lunes de la semana, no por el día del corte, así
  que enseñaba el estado anterior: parecía que no se guardaba.
- La **app del socio** filtraba por solapamiento con la semana, así que salían
  el viejo y el nuevo a la vez (13 ejercicios donde tocaban 7).
- Un día se pone verde cuando se completan **todos** sus ejercicios, y con seis
  que ya no tocaban era imposible.

Caso real: programa de Iván Fernández González (id 120), editado el 8/9 a las
17:40.

---

## 2. Lo que se ha publicado

| Versión | Qué lleva |
|---|---|
| **2.3.14** | Se retira la edición por semanas. Recuperación automática del orden de días. Seis correcciones en el camino de crear programas. |
| **2.3.15** | Guardado desbloqueado en programas solapados. Los errores se ven en la pantalla de ejercicios. La fecha propuesta nunca cae en el pasado. |

En la app del socio (repo `gym-manager-app`, rama **`master`**, que es la que
despliega Vercel): orden de días por posición, la semana en curso muestra lo de
hoy, y la lógica de semanas, estado, completado, cuotas y racha extraída a
módulos con 108 tests.

**Josema está en 2.3.15 y ya ha guardado con ella.**

---

## 3. Las reglas que rigen ahora (implementadas, SIN publicar)

Está todo en `main` sin publicar. Son cinco reglas:

1. **El cambio entra hoy**, salvo en un día que el cliente ya haya entrenado
   esta semana: ese entra al empezar su siguiente semana, para no descuadrarle
   una sesión hecha. **Se decide por día, no por programa.**
2. **Nada se borra** sin que conste que se puede. Solo se elimina si el programa
   no ha empezado Y no tiene ningún entrenamiento, comprobado contra la nube. Si
   no, se retira con un rango vacío: invisible siempre, pase lo que pase con las
   fechas.
3. **Las fechas no pueden dejar fuera lo ya entrenado.** Única condición, en los
   dos extremos y los dos sentidos.
4. **Sin conexión** se va a lo seguro: todos los días cuentan como entrenados,
   no se borra nada y no se dejan tocar las fechas.
5. **Se elige lunes**, nunca uno pasado.

Y dos añadidos para el entrenador:

- **Historial de cambios**: "el 8 de septiembre quitaste Prensa del Día 3 y
  añadiste TDC en step". Sale de las fechas de vigencia, no se guarda aparte.
- **"Crear el siguiente copiando este"**: cierra el actual la víspera y crea uno
  nuevo con el mismo contenido desde el lunes elegido. Es la salida cuando las
  reglas de fecha bloquean.

### Semanas del PROGRAMA, no del calendario

Las semanas van de siete en siete **desde la fecha de inicio**. Cuatro de los 75
programas activos no empiezan en lunes, y ahí la semana del cliente va, por
ejemplo, de miércoles a martes.

---

## 4. Dónde está cada cosa

### Escritorio (`coreBuild`)

| Fichero | Qué hace |
|---|---|
| `src/main/services/local/cortes.js` | Reglas puras: cuándo entra un cambio, qué fechas valen. **28 tests.** |
| `src/main/services/local/training.service.js` | `saveMesocycle` (decide y guarda) y `getEstadoEdicion` (pregunta a la nube). |
| `src/main/db/migrations/day-order.js` | Recupera el orden de días perdido. **18 tests.** |
| `src/renderer/features/training/vigencia.js` | Espejo de las reglas para el editor. |
| `src/renderer/features/training/historial-cambios.js` | Historial a partir de las fechas de vigencia. **10 tests.** |
| `src/renderer/features/training/MesocycleEditor.jsx` | El editor. |
| `scripts/check-no-secrets.js` | Impide empaquetar un token de GitHub. |

Baterías: `training.service.matriz.test.js` (61 casos, cada cambio en cada
estado), `.creacion.test.js` (14, sesiones completas), `.week.test.js`,
`.days.test.js`.

### App del socio (`gym-client-app`)

`src/lib/semanas.ts`, `programa.ts`, `completado.ts`, `pagos.ts`, `racha.ts`,
`entitlements.ts` — todos con su `.test.ts` al lado. **108 tests.**

---

## 5. Cómo se ejecuta y se publica

### Tests del escritorio — OJO

`better-sqlite3` está compilado para el ABI de Electron, así que los tests del
proceso principal **necesitan el Node de Electron**. Con el del sistema fallan
ocho por el ABI, y **no es un fallo del código**:

```bash
ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --selectProjects main
npx jest --selectProjects renderer
```

### App del socio

```bash
npm test        # vitest
npx tsc --noEmit
npx next build
```

### Publicar el escritorio

El token de GitHub **no puede vivir en `.env.local`**: ese fichero se empaqueta
dentro del instalador y acaba en el PC de cada gimnasio. Hay una guardia que
aborta el empaquetado si lo detecta. Va en la terminal:

```bash
$env:GH_TOKEN = "ghp_..."
npm run ship
```

`electron-builder` crea la release **como borrador**. Hay que pasarla a pública
después, o nadie la recibe.

---

## 6. Lo que se encontró en los datos reales

- **12 clientes con dos programas activos solapados.** El viejo nunca se cerró
  al crear el nuevo. Bloqueaba la edición hasta la 2.3.15.
- **1.364 entrenamientos de 7 clientes caen fuera de su programa.** Causa: el
  entrenador **reutiliza** el programa de la temporada pasada y le cambia las
  fechas, en vez de crear uno nuevo. Se ve en los nombres: "Tamara Ros Romero -
  Junio 2026" empieza el 10 de agosto. **Copiar sí crea filas independientes; el
  problema es reutilizar.**
- **El programa 94 de José Pérez Merlos** está en local pero no en la nube, con
  86 entrenamientos dentro. **No borrarlo.**
- **Margen de impago: 10 días.** Un tercio de los pagos se registra después del
  día 10. Si se activa el bloqueo con ese margen, ~60 socios que sí han pagado
  se quedarían fuera. Subirlo a 20-25 antes.

---

## 7. Pendiente

**Antes de publicar lo que hay en `main`:**

- Probar por pantalla (ver el guion abajo).
- Empaquetar y publicar como 2.3.16.

**Apuntado, sin hacer:**

- Avisar con números reales al **borrar un programa entero**: sigue destruyendo
  el vínculo de sus entrenamientos.
- **Guardar sin conexión tarda hasta 15 segundos** (el editor consulta la nube y
  espera al tiempo límite). Conviene comprobar la conexión antes o bajarlo.
- **Las dos ramas del móvil siguen divididas**: `main` tiene 6 commits que nunca
  llegan a producción, incluido el bloqueo por impago. Unificar o descartar.
- **No hay reporte de errores** en ninguna de las dos apps.
- **Cientos de errores 400 al día** pidiendo avatares que no existen.
- **Cerrar los 12 programas solapados** poniéndoles la fecha de fin del día
  antes del siguiente. No borrarlos.
- **Revocar el token de GitHub** que se usó hoy.

---

## 8. Guion de pruebas

Con un programa **en marcha y con entrenamientos**:

1. Al abrirlo, arriba dice desde cuándo entran los cambios. Las pestañas de días
   que el cliente ya entrenó esta semana salen marcadas.
2. Quitar un ejercicio de un día **no** marcado → al reabrir no está.
3. Quitar uno de un día **sí** marcado → al reabrir sigue estando (entra la
   semana que viene).
4. "Cambios hechos en este programa" lista lo quitado y lo añadido por fecha.
5. En fechas sale el recuadro con cuántos entrenamientos y de cuándo a cuándo.
6. Poner un inicio posterior al primer entrenamiento → rojo, no deja seguir.
7. Ponerlo anterior o igual → deja.
8. "Crear el siguiente copiando este" → el viejo queda cerrado la víspera y el
   nuevo tiene los mismos ejercicios, empezando limpio.

Con un programa **nuevo**:

9. Salen los dos botones de lunes, ninguno anterior a hoy.
10. Añadir, quitar y guardar → al reabrir está exactamente igual.
11. Quitar, guardar, volver a añadir, guardar → aparece una sola vez.

**Sin conexión**:

12. Avisa de que los cambios esperan a la semana que viene y que no se puede
    quitar nada definitivamente.

---

## 9. Cómo retomar en otro equipo

```bash
git pull origin main
npm install
npm run dev
```

Si el repositorio local tiene trabajo sin subir, **mirarlo antes de traer nada**
(`git status`, `git log --oneline -3`).
