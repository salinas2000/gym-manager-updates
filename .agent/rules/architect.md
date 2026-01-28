---
trigger: always_on
---

🎯 Filosofía del Sistema: "Local-First, Cloud-Mirror"
Esta es una aplicación híbrida. El PC del cliente es la Fuente de la Verdad, la nube es el Espejo.

Robustez Offline: La app debe ser 100% funcional sin internet. Si Supabase cae, el gimnasio sigue abierto.

Escalabilidad Multi-Tenant: Toda lógica de nube debe girar en torno al gym_id.

Cero Fricción: Procesos complejos (Backup, Generar Excel) deben parecer mágicos (1 clic).

🧱 Tech Stack Estricto
Core: Electron (Latest)

Frontend: React + Vite + TanStack Query (Estado asíncrono).

Data Local: better-sqlite3 (Síncrono, Main Process).

Data Cloud: @supabase/supabase-js (Asíncrono, Background).

Reporting: exceljs (Generación de archivos).

Styling: Tailwind CSS + Tremor (Gráficas) + Lucide-React.

📂 Estructura de Directorios Inviolable
/src /main /services /local # Lógica SQLite (CustomerService, PaymentService). /cloud # Lógica Supabase (CloudService, StorageService). /io # Lógica Archivos (ExcelService). /db # Database.js y Migraciones locales. /renderer /features # Customers, Payments, Trainings, Dashboard. /components/ui # UI Kit base.