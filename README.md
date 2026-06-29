# Exotics Co. — HQ Virtual

Proyecto React para el HQ de Exotics Co. Migrado desde un Artifact de Claude
a una estructura de proyecto real, lista para trabajar con **Claude Code**.

## Qué incluye este scaffold

- ✅ Estructura de proyecto React + Vite, con rutas (`react-router-dom`)
- ✅ Identidad de marca aplicada (negro, cyan `#13C5F4`, tipografía Titillium Web)
- ✅ Store global (`src/lib/store.jsx`) con persistencia en `localStorage`
- ✅ Las 9 páginas/módulos ya armadas y funcionando:
  Dashboard, Contactos, Funnel, Inventario, Retomas, Búsquedas, Ventas,
  Actividades, Contenidos, Finanzas
- ✅ Helpers compartidos (fechas, moneda, etapas del funnel) en `src/lib/utils.js`

## Qué falta pulir (para pedirle a Claude Code)

Este scaffold prioriza tener **toda la lógica de negocio funcionando** en
componentes separados. Algunas cosas del Artifact original quedaron
simplificadas a propósito, para que Claude Code las termine con vos
viendo el código real:

- [ ] Vista de **calendario mensual visual** en Actividades y Contenidos
      (por ahora son tablas; el Artifact original tenía grid de días)
- [ ] Modal de "interesados por vehículo" en Inventario con botón de notificar
- [ ] Detalle expandible de Retomas con cálculo de rentabilidad por participante
- [ ] Filtros de fecha rápidos (Hoy / Semana / Mes) en Finanzas
- [ ] Badge de cumpleaños próximos en la tabla de Contactos
- [ ] Conectar el campo "vehículo de interés" del lead al inventario real

Para cada uno, simplemente pídele a Claude Code algo como:
> "Agrega un calendario mensual visual a la página de Actividades,
> similar a un calendario de Google, donde cada día se pueda hacer clic
> para ver las tareas de ese día."

## Cómo correr el proyecto localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:5173` en el navegador.

## Multiusuario (Simón + Roberto viendo los mismos datos)

Ahora mismo los datos se guardan en `localStorage`, así que cada persona
tiene su propia copia en su navegador. Para que ambos vean y editen los
**mismos datos en tiempo real**, hay que migrar a una base de datos.
Recomendamos **Supabase** (tiene plan gratuito generoso):

1. Crear cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo
2. Copiar la URL y la "anon key" del proyecto
3. Crear un archivo `.env` en la raíz:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxxxxxxx
   ```
4. Descomentar el código en `src/lib/supabaseClient.js`
5. Pedirle a Claude Code:
   > "Migra src/lib/store.jsx para que lea y escriba en Supabase en vez
   > de localStorage. Crea las tablas necesarias según las colecciones
   > que ya existen: leads, inventario, retomas, busquedas, ventas,
   > actividades, contenidos, finanzas."

Esto te da:
- Datos compartidos entre Simón y Roberto en tiempo real
- Login con usuario/contraseña (Supabase Auth)
- Backups automáticos

## Desplegar en internet (para no depender de "localhost")

Una vez migrado a Supabase, el siguiente paso es subirlo a un dominio real:

1. Crear cuenta gratis en [vercel.com](https://vercel.com)
2. Conectar el repositorio de GitHub (Claude Code te puede ayudar a
   crear el repo con `git init` y subirlo)
3. Vercel detecta automáticamente que es un proyecto Vite y lo despliega
4. Opcional: conectar un dominio propio como `hq.exoticsco.com`

## Estructura de carpetas

```
exotics-hq/
├── src/
│   ├── components/
│   │   └── Sidebar.jsx          ← navegación lateral
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Contactos.jsx
│   │   ├── Funnel.jsx
│   │   ├── Inventario.jsx
│   │   ├── Retomas.jsx
│   │   ├── Busquedas.jsx
│   │   ├── Ventas.jsx
│   │   ├── Actividades.jsx
│   │   ├── Contenidos.jsx
│   │   └── Finanzas.jsx
│   ├── lib/
│   │   ├── store.jsx            ← estado global + persistencia
│   │   ├── supabaseClient.js    ← preparado para cuando migren
│   │   └── utils.js             ← funciones compartidas
│   ├── styles/
│   │   └── theme.css            ← colores e identidad de marca
│   ├── App.jsx                  ← rutas
│   └── main.jsx                 ← entry point
├── index.html
├── package.json
└── vite.config.js
```

## Identidad de marca usada

- Negro base: `#0D0D0D` / `#111111`
- Cyan acento (Pantone 801 C): `#13C5F4`
- Tipografía: Titillium Web (Google Fonts)

---

Cualquier ajuste visual o de lógica, pídeselo directamente a Claude Code
señalando el archivo específico — por ejemplo: *"en src/pages/Inventario.jsx,
agrega la columna de kilometraje a la tabla"*.
