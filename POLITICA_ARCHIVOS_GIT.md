# 📦 Gestión de Archivos en Git

**Política:** Solo archivos funcionales y descriptivos. Sin archivos generados o temporales.

---

## ✅ INCLUIDOS EN GIT (Funcionales + Descriptivos)

### Código Fuente (Funcional)
```
src/
├── index.js                    ✅ Entry point del servidor
├── config/
│   ├── db.js                  ✅ Conexión MongoDB
│   └── cloudinary.js          ✅ Configuración Cloudinary
├── controllers/               ✅ Lógica de negocio
│   ├── adminAuthController.js
│   ├── productController.js
│   └── seedController.js
├── routes/                    ✅ Rutas API
│   ├── adminAuthRoutes.js
│   ├── adminProductosRoutes.js
│   ├── productRoutes.js
│   ├── seedRoutes.js
│   └── uploadRoutes.js
├── middleware/                ✅ Middlewares
│   ├── authMiddleware.js
│   ├── errorHandler.js
│   ├── security.js
│   ├── upload.js
│   └── uploadCloudinary.js
├── models/                    ✅ Esquemas MongoDB
│   ├── Admin.js
│   ├── Product.js
│   └── RefreshToken.js
├── validators/                ✅ Validación
│   └── productValidator.js
└── scripts/                   ✅ Herramientas admin
    ├── changePassword.js
    ├── listAdmins.js
    └── renameUser.js
```

### Configuración (Funcional)
```
package.json                   ✅ Dependencias y scripts
package-lock.json             ✅ Versiones exactas (asegura reproducibilidad)
vercel.json                   ✅ Configuración Vercel
.env.example                  ✅ Template de variables (sin valores reales)
.gitignore                    ✅ Qué ignorar en git
```

### Datos (Funcional)
```
Data/
└── productos.json            ✅ Datos de prueba/seed
importarProductos.js          ✅ Script para importar datos
```

### Documentación (Descriptiva)
```
README.md                         ✅ Guía principal
ESTRUCTURA_PROYECTO.md            ✅ Estructura del código
DOCUMENTACION_ACTUALIZADA.md      ✅ Cambios recientes
SCRIPTS_UTILIDAD.md              ✅ Guía de scripts
PREPARACION_DESPLIEGUE.md        ✅ Pasos para Vercel
```

---

## ❌ IGNORADOS EN GIT (No funcionales o generados)

### Dependencias (Generadas)
```
node_modules/                 ❌ Generado por npm install
package-lock.json (en algunos casos - vamos a incluir)
yarn.lock                     ❌ Si usas yarn
```

### Variables de Entorno (Sensibles)
```
.env                          ❌ Contiene credenciales reales
.env.local                    ❌ Variables locales
.env.production               ❌ Variables de producción
```

### Logs y Temporales
```
logs/                         ❌ Archivos de logging
*.log                         ❌ Node debug logs
npm-debug.log*                ❌ Logs de npm
yarn-debug.log*               ❌ Logs de yarn
tmp/                          ❌ Archivos temporales
temp/                         ❌ Cache temporal
```

### Carpetas de Subida
```
uploads/                      ❌ Subidas locales (Cloudinary en prod)
```

### IDE y Editor
```
.vscode/                      ❌ Configuración VS Code personal
.idea/                        ❌ Configuración IntelliJ personal
*.swp                         ❌ Archivos Vim
*.swo                         ❌ Archivos Vim backup
*~                            ❌ Archivos backup genéricos
```

### Sistema Operativo
```
.DS_Store                     ❌ macOS metadata
Thumbs.db                     ❌ Windows thumbnails
```

### Compilación y Build
```
dist/                         ❌ Build output (si aplica)
build/                        ❌ Build artifacts
.cache/                       ❌ Cache de build
```

### Testing
```
coverage/                     ❌ Reportes de cobertura
*.test.js                     ❌ Archivos de test (almacena en __tests__)
```

---

## 📊 Estadísticas del Repositorio

### Archivos en Git (después de push)
```
Código fuente:        ~30 archivos
Configuración:        ~5 archivos
Datos:               ~2 archivos
Documentación:       ~5 archivos
─────────────────────
Total:              ~42 archivos
```

### Archivos NO en Git
```
node_modules/       ~3000+ archivos (pero .gitignore los excluye)
.env               ~1 archivo (sensible)
logs/              ~0 archivos (si los hay)
```

### Tamaño Aproximado
```
En Git:        ~500 KB (puro código + docs)
Con deps:      ~300+ MB (node_modules)
```

---

## 🔍 Verificar qué irá a Git

Antes de hacer `git push`, verificar:

```bash
# Ver archivos a commitear
git status

# Ver archivos ignorados
git status --ignored

# Confirmar que .env NO aparece
git ls-files | grep "\.env$"
# Resultado esperado: NADA (correcto)

# Confirmar que node_modules NO aparece
git ls-files | grep "node_modules"
# Resultado esperado: NADA (correcto)
```

---

## 📝 Checklist Pre-Push

- [x] `.env` NO está en archivos a commitear
- [x] `node_modules/` NO está en archivos a commitear
- [x] `.env.example` SÍ está (documentación)
- [x] `README.md` SÍ está (documentación)
- [x] `src/` SÍ está completa (código)
- [x] `package.json` SÍ está (dependencias)
- [x] `vercel.json` SÍ está (config despliegue)
- [x] `Data/` SÍ está (datos de prueba)

---

## 🚀 Comando Final Pre-Push

```bash
# 1. Verificar estado
git status

# 2. Si todo está correcto
git add .
git commit -m "Backend ready for production"
git push -u origin main

# 3. Verificar en GitHub
# https://github.com/tu-usuario/gaddyel-backend
```

---

## 💡 Por qué esta política?

1. **Funcionalidad:** Solo código que ejecuta la aplicación
2. **Reproducibilidad:** `package.json` permite que otros hagan `npm install`
3. **Seguridad:** `.env` nunca se expone
4. **Limpieza:** Sin archivos generados o temporales
5. **Documentación:** Docs explicativas mantenidas
6. **Tamaño:** Repositorio pequeño y rápido de clonar

---

**Resultado:** Repositorio limpio, funcional y seguro. ✨

---

**Última actualización:** 27 de noviembre de 2025
