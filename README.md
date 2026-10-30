# Series — Catálogo personal

Aplicación web para administrar series, plataformas y valoraciones. Está construida con React, TypeScript, Vite y Supabase; se puede importar como proyecto Vite en Vercel.

## Funcionalidades

- CRUD de plataformas.
- CRUD de series asociadas a una plataforma.
- CRUD de valoraciones con plataforma, serie, puntaje del 1 al 10 y observación.
- Validación relacional: la plataforma de una valoración debe coincidir con la plataforma de la serie.
- Registro e inicio de sesión por correo, con datos aislados por usuario mediante políticas RLS.
- Diseño adaptable para escritorio y móvil.

## Desarrollo local

1. Instala dependencias con `npm install`.
2. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En el proyecto Supabase, ejecuta el archivo `supabase/migrations/20261030000000_create_series_catalog.sql` desde SQL Editor.
4. En Supabase, habilita el proveedor de correo y configura si quieres requerir confirmación de correo.
5. Inicia la aplicación con `npm run dev`.

La migración activa RLS y cada usuario solo puede consultar y modificar sus propios registros. El registro e inicio de sesión se realizan mediante Supabase Auth.

## Publicar en GitHub y Vercel

1. Sube este proyecto a un repositorio GitHub.
2. En Vercel, selecciona **Add New → Project** e importa ese repositorio.
3. Vercel detectará Vite. El build es `npm run build` y el directorio de salida es `dist` (también definidos en `vercel.json`).
4. Antes de desplegar, agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Settings → Environment Variables** para los entornos deseados.
5. Despliega. Si cambias variables de entorno, inicia un nuevo deployment.

La clave `anon`/publishable está diseñada para uso en el cliente y queda visible en el bundle; nunca configures una `service_role` en variables `VITE_*` ni la expongas al navegador.
