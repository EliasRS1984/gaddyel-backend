# 🛠️ Scripts de Utilidad del Backend

Los scripts en `src/scripts/` son herramientas para administración de la base de datos. No son parte del servidor HTTP, se ejecutan manualmente desde la línea de comandos.

---

## 📋 Scripts Disponibles

### 1. `listAdmins.js` - Listar Usuarios Admin

**Descripción:** Muestra todos los usuarios administradores en la BD

**Uso:**
```bash
node src/scripts/listAdmins.js
```

**Salida esperada:**
```
✅ Conectado a MongoDB
📋 Usuarios admin encontrados (1):
1. Elias (ID: 507f1f77bcf86cd799439011)
```

**Cuándo usar:** Para verificar qué usuarios admin existen

---

### 2. `changePassword.js` - Cambiar Contraseña

**Descripción:** Cambia la contraseña de un usuario admin existente

**Uso:**
```bash
node src/scripts/changePassword.js
```

**Nota:** Edita el script para cambiar `usuario` y `newPassword` según necesites

**Ubicación de parámetros:**
```javascript
const usuario = 'Elias';           // Cambiar este usuario
const newPassword = 'Callao1929';  // Cambiar esta contraseña
```

**Pasos:**
1. Abrir `src/scripts/changePassword.js`
2. Cambiar `usuario` y `newPassword`
3. Guardar
4. Ejecutar: `node src/scripts/changePassword.js`

**Salida esperada:**
```
✅ Conectado a MongoDB
🔄 Cambiando contraseña para usuario: Elias
✅ Contraseña actualizada correctamente
📝 Usuario: Elias
🔑 Contraseña: Callao1929
```

---

### 3. `renameUser.js` - Renombrar Usuario Admin

**Descripción:** Cambia el nombre de usuario de un admin existente

**Uso:**
```bash
node src/scripts/renameUser.js
```

**Nota:** Edita el script para especificar el usuario actual y el nuevo nombre

**Ubicación de parámetros:**
```javascript
const usuarioActual = 'testadmin';   // Usuario a renombrar
const usuarioNuevo = 'Elias';        // Nuevo nombre
const password = 'Callao1929';       // Contraseña (para hash)
```

**Pasos:**
1. Abrir `src/scripts/renameUser.js`
2. Cambiar `usuarioActual` y `usuarioNuevo`
3. Guardar
4. Ejecutar: `node src/scripts/renameUser.js`

---

## ⚠️ Notas Importantes

- **Antes de ejecutar scripts:** Asegúrate de que el servidor NO esté corriendo (para evitar bloqueos de BD)
- **Variables de entorno:** Los scripts leen `.env`, así que debe estar presente
- **Credenciales:** Nunca almacenes credenciales en los scripts permanentemente
- **Producción:** Ejecuta scripts en Vercel usando `vercel env pull` o a través de webhooks

---

## 🚀 Ejemplo: Crear Nuevo Admin (Script Manual)

Si quieres crear un nuevo usuario admin, puedes:

**Opción 1: Usar script existente**
```bash
# Modificar renameUser.js para tu caso
# Cambiar: usuarioActual a cualquier admin existente
# Cambiar: usuarioNuevo al nuevo nombre que quieres
node src/scripts/renameUser.js
```

**Opción 2: Crear un script nuevo**
```javascript
// src/scripts/createAdmin.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcryptjs from 'bcryptjs';
import Admin from '../models/Admin.js';

dotenv.config();

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const usuario = 'nuevo_usuario';  // Cambiar aquí
        const password = 'nueva_contraseña';  // Cambiar aquí
        
        const existe = await Admin.findOne({ usuario });
        if (existe) {
            console.log('❌ El usuario ya existe');
            process.exit(1);
        }
        
        const hash = await bcryptjs.hash(password, 10);
        const nuevoAdmin = new Admin({ usuario, password: hash });
        await nuevoAdmin.save();
        
        console.log('✅ Admin creado exitosamente');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

createAdmin();
```

---

## 📝 Checklist Antes de Producción

- [ ] Todos los usuarios admin tienen contraseñas seguras
- [ ] Se ha verificado con `listAdmins.js` que existen los usuarios necesarios
- [ ] Se han eliminado usuarios innecesarios (usar `renameUser.js` o MongoDB Compass)
- [ ] Los scripts NO están commitados con datos sensibles
- [ ] Se documenta cómo crear nuevos admins en Vercel

---

## 🔐 Seguridad en Producción

**En Vercel:**

1. NO ejecutar scripts directamente
2. Usar MongoDB Compass para administración de BD si es necesario
3. O crear un endpoint administrativo protegido si se necesita crear admins frecuentemente

---

**Última actualización:** 27 de noviembre de 2025
