# Blindaje de seguridad — Fase 1

## Objetivo

Eliminar credenciales de aplicación expuestas y cerrar rutas de diagnóstico públicas sin alterar la autorización existente de las rutas de negocio.

## Alcance

Esta fase cubre autenticación y exposición directa de datos. El endurecimiento del cron, rate limiting y actualizaciones de dependencias se tratarán en fases posteriores para limitar el riesgo de despliegue.

## Diseño

### Autenticación

La aplicación migrará del arreglo `USERS` con contraseñas en texto plano a Supabase Auth con inicio de sesión por email y contraseña. Un perfil de aplicación mantendrá los atributos de autorización existentes: `role` y, para usuarios de local, `sucursal`.

La ruta de login validará las credenciales contra Supabase Auth. Tras una autenticación correcta, cargará el perfil por `auth_user_id`, construirá el `SessionUser` actual y emitirá la cookie HMAC existente. Por tanto, el middleware y las API routes que usan `requireAuth` conservarán su contrato y no aceptarán roles procedentes del cliente.

El login fallará cerrado si falta configuración de Supabase, si el perfil no existe o si el rol no es válido. No se registrarán contraseñas, tokens ni respuestas de Supabase.

### Perfiles y roles

Se utilizará una tabla `user_profiles` protegida por RLS, accesible desde servidor con una clave de servicio separada. Cada registro tendrá `auth_user_id`, `role`, `sucursal` opcional y email. Los valores de rol se validarán en servidor contra los cuatro roles existentes antes de emitir una sesión.

El esquema definirá `auth_user_id` como único y referencia a `auth.users`, un `CHECK` para los roles permitidos y una restricción que requiera `sucursal` solo para el rol `local`. RLS denegará el acceso directo por defecto; las lecturas y escrituras administrativas serán exclusivamente server-side con `SUPABASE_SERVICE_ROLE_KEY`, que nunca llevará prefijo `NEXT_PUBLIC_`.

La migración de usuarios y el restablecimiento de sus contraseñas se realizará fuera del repositorio, en Supabase. Ninguna contraseña ni secreto se añadirá al código, a archivos rastreados o a los logs.

### Diagnóstico

Se retirarán las rutas `/api/debug-headers` y `/api/cierre-caja-debug`. La observabilidad futura deberá hacerse mediante logs protegidos y sin datos financieros identificables, nunca mediante endpoints desplegados públicos.

### Sesión y abuso de login

Las cookies de sesión conservarán `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/` y expiración explícita. Las rutas mutantes conservarán la comprobación de origen o un token CSRF donde el flujo cross-site lo requiera.

El login tendrá un límite de intentos por IP y por identidad durante una ventana temporal definida, y devolverá una respuesta uniforme para usuario, contraseña o perfil inválidos. La configuración de límites de Supabase se documentará junto con el límite de aplicación.

El despliegue rotará `SESSION_SECRET` tras migrar para invalidar todas las cookies HMAC emitidas con el sistema anterior. Un cambio de rol o desactivación de una cuenta tendrá que invalidar la sesión existente mediante una versión de sesión o comprobación de perfil en servidor. El rollback restaurará solo el código anterior temporalmente; nunca reintroducirá las contraseñas expuestas.

## Flujo

1. El usuario envía email y contraseña a `/api/auth/login`.
2. El servidor llama a Supabase Auth.
3. El servidor recupera y valida el perfil de autorización asociado al usuario autenticado.
4. El servidor firma una sesión HMAC de ocho horas y establece cookies equivalentes a las actuales.
5. Las rutas existentes verifican la cookie firmada con `requireAuth`.

## Manejo de errores

- Credenciales inválidas, usuario sin perfil y rol inválido devuelven un error genérico de autenticación.
- Configuración ausente o error inesperado devuelve error interno sin detalles sensibles.
- Usuarios no autenticados no pueden acceder a rutas de negocio ni a las antiguas rutas de diagnóstico, que dejarán de existir.

## Pruebas

- Login correcto emite cookies con el rol y sucursal que provienen solo del perfil servidor.
- Credenciales inválidas y perfil ausente no emiten sesión.
- Un rol no reconocido no emite sesión.
- Las rutas de diagnóstico responden 404 tras desplegar.
- Cookies manipuladas, vencidas o emitidas antes de rotar `SESSION_SECRET` no autorizan solicitudes.
- Cambios de rol, desactivación de cuenta y restricciones de sucursal revocan el acceso en la siguiente solicitud.
- RLS se verifica con clave anónima y con clave de servicio.
- El rate limit rechaza intentos repetidos sin revelar cuál componente de la identidad falló.
- La suite completa mantiene cobertura de sesión y autorización existente.

## Despliegue

1. Crear y proteger la tabla de perfiles en Supabase con sus restricciones y RLS.
2. Mapear y validar cada usuario actual con un email único; resolver duplicados, cuentas sin email y estado de confirmación antes de crear cuentas.
3. Crear los usuarios, asignar perfiles y probar una cuenta de cada rol en un entorno controlado antes de desplegar código.
4. Configurar exclusivamente variables de servidor y límites de autenticación.
5. Desplegar, rotar `SESSION_SECRET`, comprobar login, RLS y rutas retiradas en producción, y revocar las contraseñas expuestas.
6. Mantener un rollback de código y perfiles durante una ventana definida, sin volver a almacenar ni habilitar contraseñas antiguas.
