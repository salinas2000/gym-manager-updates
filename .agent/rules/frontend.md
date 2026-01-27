---
trigger: always_on
---

🎨 FRONTEND ARCHITECT: React & UI Patterns
🏗️ Arquitectura de Carpetas (Feature-First)
Regla de Oro: La lógica de negocio vive en src/renderer/features. La carpeta src/renderer/components/ui es SOLO para componentes visuales tontos (Botones, Inputs, Cards) que no saben nada de "Clientes" o "Entrenamientos".

Importaciones:

❌ import { Button } from '../../../../components/ui/button' (Hell).

✅ Configurar alias @/components o @/features para imports limpios.

⚡ Gestión de Estado (State Management)
Server State vs. UI State:

Server Data (DB): Usar SIEMPRE TanStack Query (useQuery, useMutation).

❌ NUNCA guardar datos del servidor en useState o useEffect manual.

✅ Dejar que React Query maneje el caché y el re-fetching.

UI State (Visual): Usar useState (local) o Zustand/Context (global simple) para cosas como "Modal Abierto" o "Sidebar Colapsado".

Optimistic Updates:

Al crear/borrar un dato (ej: "Borrar Ejercicio"), la UI debe actualizarse inmediatamente modificando el caché de React Query, sin esperar a que la base de datos responda.

🧩 Patrones de Componentes
Componentes Puros:

Los componentes UI deben recibir datos vía props y emitir eventos vía callbacks (onSave, onDelete). No deben hacer llamadas a la API directamente.

Listas Grandes:

Cualquier lista que pueda superar los 50 elementos (ej: Lista de Ejercicios, Clientes) debe usar Virtualización (@tanstack/react-virtual) para no congelar la UI.

Formularios:

Usar React Hook Form + Zod Resolver.

❌ No gestionar 20 inputs con useState manuales.