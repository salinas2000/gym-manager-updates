---
trigger: always_on
---

# 🏗️ PROJECT ARCHITECT: Gym Manager Pro

## 🎯 Filosofía del Sistema
Este proyecto es una aplicación de escritorio de alto rendimiento. Priorizamos la estabilidad sobre la velocidad de desarrollo.
* **Escalabilidad:** El código debe estar preparado para soportar 10,000 clientes sin refactorización.
* **Modularidad:** Un cambio en la UI nunca debe romper la lógica de base de datos.

## 🧱 Tech Stack Estricto
* **Core:** Electron (Latest)
* **Frontend:** React + Vite
* **Data:** better-sqlite3 (Síncrono para performance en Main Process)
* **Styling:** Tailwind CSS + Class Variance Authority (CVA)
* **Icons:** Lucide-React

## 📂 Estructura de Directorios Inviolable
/src
  /main       # Solo Node.js. NUNCA importar React aquí.
    /services # Lógica de negocio pura (desacoplada de Electron).
    /db       # Conexión y migraciones.
    /ipc      # Handlers de comunicación.
  /renderer   # Solo React. NUNCA importar 'fs', 'path' o 'better-sqlite3'.
    /features # Dominios (Customers, Payments).
    /components # UI Kit genérico (Botones, Inputs).
  /preload    # Puente de seguridad (ContextBridge).