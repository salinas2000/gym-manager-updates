# 🧪 Guía de Testing - Gym Manager Pro

Sistema completo de testing para aplicación Electron + React.

---

## 📋 Tabla de Contenidos

- [Resumen](#-resumen)
- [Configuración](#-configuración)
- [Ejecutar Tests](#-ejecutar-tests)
- [Escribir Tests](#-escribir-tests)
- [Convenciones](#-convenciones)
- [CI/CD](#-cicd)

---

## 🎯 Resumen

### Stack de Testing

- **Jest** v30 - Framework de testing
- **@testing-library/react** - Testing de componentes React
- **@testing-library/jest-dom** - Matchers personalizados
- **babel-jest** - Transformación de ES6/JSX

### Cobertura Actual

| Módulo | Tests | Estado |
|--------|-------|--------|
| **Credential Manager** | ✅ 8 tests | Completo |
| **Customer Service** | ✅ 15 tests | Completo |
| **Payment Service** | ✅ 9 tests | Completo |
| **Error Boundary** | ✅ 4 tests | Completo |
| **Otros servicios** | ⚠️ Pendiente | En desarrollo |

---

## ⚙️ Configuración

### Archivos de Configuración

```
gym-manager-pro/
├── jest.config.js           # Configuración principal
├── babel.config.js          # Transformación ES6/JSX
└── tests/
    ├── setup.js             # Setup global
    ├── setup-main.js        # Setup para main process
    ├── setup-renderer.js    # Setup para renderer process
    └── __mocks__/          # Mocks globales
        └── fileMock.js
```

### Entornos de Test

La configuración usa **projects** de Jest para probar ambos procesos:

1. **Main Process** (Node.js)
   - Entorno: `node`
   - Tests: `src/main/**/*.test.js`
   - Mocks: Electron APIs, better-sqlite3, fs

2. **Renderer Process** (Browser)
   - Entorno: `jsdom`
   - Tests: `src/renderer/**/*.test.js`
   - Mocks: window.electron (IPC), DOM APIs

---

## 🚀 Ejecutar Tests

### Comandos Principales

```bash
# Ejecutar todos los tests
npm test

# Ejecutar en modo watch (desarrollo)
npm run test:watch

# Ejecutar con reporte de cobertura
npm run test:coverage

# Solo tests de main process
npm run test:main

# Solo tests de renderer process
npm run test:renderer

# Para CI/CD
npm run test:ci
```

### Ver Cobertura

```bash
npm run test:coverage

# El reporte se genera en: coverage/lcov-report/index.html
```

---

## ✍️ Escribir Tests

### Test de Servicio (Main Process)

```javascript
// src/main/services/local/customer.service.test.js

const CustomerService = require('./customer.service');

jest.mock('../../db/database');
jest.mock('./license.service');

describe('Customer Service', () => {
  let customerService;
  let mockDb;

  beforeEach(() => {
    customerService = new CustomerService();
    mockDb = global.testUtils.createMockDb();

    const dbManager = require('../../db/database');
    dbManager.getInstance = jest.fn(() => mockDb);

    jest.clearAllMocks();
  });

  describe('create()', () => {
    test('should create customer with valid data', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@test.com'
      };

      mockDb.prepare().run.mockReturnValue({ lastInsertRowid: 1 });

      const result = customerService.create(customerData);

      expect(result).toHaveProperty('id', 1);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should reject invalid email', () => {
      const customerData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'invalid-email'
      };

      expect(() => customerService.create(customerData)).toThrow();
    });
  });
});
```

### Test de Componente React

```javascript
// src/renderer/components/MyComponent.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  test('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  test('should handle click event', () => {
    const handleClick = jest.fn();
    render(<MyComponent onClick={handleClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('should update state', () => {
    render(<MyComponent />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });

    expect(input.value).toBe('test');
  });
});
```

### Test de IPC Handler

```javascript
// src/main/ipc/handlers.test.js

const { ipcMain } = require('electron');

describe('IPC Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should register customers:getAll handler', () => {
    require('./handlers');

    expect(ipcMain.handle).toHaveBeenCalledWith(
      'customers:getAll',
      expect.any(Function)
    );
  });

  test('should handle successful response', async () => {
    const mockHandler = jest.fn().mockResolvedValue([{ id: 1 }]);
    ipcMain.handle.mockImplementation((channel, handler) => {
      if (channel === 'test') return handler();
    });

    // Test implementation
  });
});
```

---

## 📐 Convenciones

### Estructura de Archivos

```
src/
├── main/
│   └── services/
│       └── local/
│           ├── customer.service.js
│           └── customer.service.test.js    ← Test al lado del código
│
└── renderer/
    └── components/
        ├── Button.jsx
        └── Button.test.jsx                 ← Test al lado del componente
```

### Nombres de Tests

```javascript
// ✅ BUENO: Descriptivo y específico
describe('Customer Service', () => {
  describe('create()', () => {
    test('should create customer with valid data', () => {});
    test('should reject invalid email', () => {});
    test('should handle duplicate email error', () => {});
  });
});

// ❌ MALO: Vago y poco claro
describe('Customer', () => {
  test('works', () => {});
  test('test1', () => {});
});
```

### Qué Testear

#### ✅ SÍ testear:
- **Lógica de negocio** - Cálculos, validaciones, transformaciones
- **Edge cases** - Valores límite, null, undefined
- **Error handling** - Validación de errores esperados
- **Interfaces públicas** - APIs de servicios y componentes
- **Interacciones de usuario** - Clicks, inputs, navegación

#### ❌ NO testear:
- **Implementación interna** - Detalles privados que pueden cambiar
- **Librerías de terceros** - Ya están testeadas
- **Código trivial** - Getters/setters simples sin lógica
- **Estilos CSS** - Usa tests visuales/manuales

---

## 📊 Cobertura de Código

### Objetivos (Configurados en jest.config.js)

```javascript
coverageThreshold: {
  global: {
    branches: 50%,    // Cobertura de ramas
    functions: 50%,   // Cobertura de funciones
    lines: 60%,       // Cobertura de líneas
    statements: 60%   // Cobertura de statements
  }
}
```

### Ver Reporte Detallado

```bash
npm run test:coverage

# Abrir reporte HTML
open coverage/lcov-report/index.html
```

### Ignorar Archivos

En `jest.config.js`:

```javascript
collectCoverageFrom: [
  'src/**/*.{js,jsx}',
  '!src/**/*.test.{js,jsx}',     // Ignorar tests
  '!src/**/__tests__/**',         // Ignorar carpetas de tests
  '!src/renderer/main.jsx',       // Ignorar entry points
  '!**/node_modules/**'
]
```

---

## 🔧 Mocks y Utilities

### Mocks Globales

Configurados en `tests/setup-main.js`:

```javascript
// Electron APIs
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path'),
    getVersion: jest.fn(() => '1.0.7')
  },
  ipcMain: {
    handle: jest.fn()
  }
}));

// Better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    })),
    exec: jest.fn()
  }));
});
```

### Utilidades de Testing

```javascript
// tests/setup.js

global.testUtils = {
  createMockDb: () => ({
    prepare: jest.fn(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    })),
    exec: jest.fn(),
    transaction: jest.fn((fn) => fn)
  }),

  createMockCredentials: () => ({
    supabase: { url: 'https://test.supabase.co', key: 'test' },
    google: { clientId: 'test', clientSecret: 'test' }
  })
};
```

---

## 🔄 CI/CD

### GitHub Actions

Archivo: `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Pre-commit Hook

Instala Husky para ejecutar tests antes de commit:

```bash
npm install --save-dev husky

npx husky install

npx husky add .husky/pre-commit "npm test"
```

---

## 🐛 Debugging Tests

### En VSCode

Crea `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest Debug",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-coverage"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Comandos Útiles

```bash
# Ejecutar un solo archivo de test
npm test -- customer.service.test.js

# Ejecutar tests que contengan "create"
npm test -- -t create

# Ver output detallado
npm test -- --verbose

# No correr en paralelo (útil para debugging)
npm test -- --runInBand
```

---

## 📚 Recursos

### Documentación Oficial
- [Jest](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)

### Best Practices
- [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details)

---

## 🤝 Contribuir

### Agregar Nuevos Tests

1. Crea archivo `.test.js` o `.test.jsx` al lado del código
2. Sigue las convenciones de nombres
3. Asegura cobertura > 60%
4. Ejecuta `npm test` antes de commit
5. Actualiza esta documentación si es necesario

### Reportar Issues

Si encuentras bugs en tests o configuración:
1. Crea issue en GitHub
2. Incluye comando exacto que falla
3. Incluye output completo del error
4. Incluye versión de Node.js y npm

---

**Última actualización**: 2026-02-09
**Versión**: 1.0.0 (Sistema de Testing)
