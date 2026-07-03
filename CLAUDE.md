# Exotics Co. HQ — Documento de Contexto para Claude Code

> Este documento resume todo el historial de decisiones, arquitectura, configuración
> y estado actual del proyecto CRM de Exotics Co., para que Claude Code tenga contexto
> completo sin necesidad de explicar nada desde cero.

---

## 1. ¿Qué es este proyecto?

CRM completo para **Exotics Co.**, empresa colombiana de compraventa de vehículos de alta gama.
Fundadores: **Simón** (simonortega99@gmail.com) y **Roberto** — ambos usuarios admin.

La app se llama internamente **Exotics Co. HQ Virtual**.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Estado global | Context API + localStorage → migrado a Supabase |
| Base de datos | Supabase (PostgreSQL) |
| Autenticación | Supabase Auth (email + contraseña) |
| Deploy | Vercel (auto-deploy en cada `git push`) |
| Repositorio | GitHub: `simonortega99/exotics-crm` |
| Integración extra | Google Sheets webhook (Apps Script) |

---

## 3. Identidad de marca

- **Color principal:** Negro `#111111`
- **Acento cyan:** `#13C5F4` (Pantone 801 C)
- **Tipografía:** Titillium Web (Google Fonts)
- **Tono:** Premium, aspiracional, exclusivo — nunca genérico ni "hecho por IA"

---

## 4. Estructura del proyecto

```
exotics-hq/
├── src/
│   ├── components/
│   │   └── Sidebar.jsx              ← navegación lateral
│   ├── pages/
│   │   ├── Dashboard.jsx            ← KPIs y alertas
│   │   ├── Contactos.jsx            ← leads con tareas y seguimiento
│   │   ├── Funnel.jsx               ← kanban horizontal con % conversión
│   │   ├── Inventario.jsx           ← vehículos con interesados vinculados
│   │   ├── Retomas.jsx              ← inversión + rentabilidad + participantes
│   │   ├── Busquedas.jsx            ← match automático con inventario
│   │   ├── Ventas.jsx               ← registro con días de venta automáticos
│   │   ├── Actividades.jsx          ← calendario mensual de tareas
│   │   ├── Contenidos.jsx           ← calendario de posts por cuenta de red social
│   │   └── Finanzas.jsx             ← ingresos/egresos con filtros de fecha
│   ├── lib/
│   │   ├── store.jsx                ← estado global (swappable: localStorage → Supabase)
│   │   ├── supabaseClient.js        ← cliente Supabase (ya configurado y activo)
│   │   └── utils.js                 ← helpers: fechas, moneda, etapas del funnel
│   ├── styles/
│   │   └── theme.css                ← variables de marca
│   ├── App.jsx                      ← rutas con HashRouter
│   └── main.jsx                     ← entry point
├── .env                             ← claves privadas (no está en GitHub)
├── .gitignore
├── index.html
├── package.json
└── vite.config.js
```

---

## 5. Módulos — decisiones de negocio

### Dashboard
- KPIs: leads activos, ventas mes vs meta, inventario disponible, ticket promedio, días promedio venta, comisiones
- Meta de ventas configurable
- Alertas automáticas: tareas del día, cumpleaños próximos (≤3 días), leads calientes sin tareas, consignaciones con +30 días sin vender
- Panel de métricas de redes sociales (Instagram + TikTok) actualizables manualmente

### Contactos (Leads)
- Roles: Lead, Cliente, Consignante, Aliado
- Termómetro: Frío / Tibio / Caliente
- Funnel de 5 etapas: Nuevo lead → Contactado → Interesado → Negociación → Cerrado
- Vehículo de interés vinculado directamente al inventario (no texto libre)
- Sistema de tareas con fecha, check de completado, atajos rápidos (+1d, +3d, +1sem, etc.)
- Campo de cumpleaños con alerta automática
- Fuente de origen (Instagram, Referido, MercadoLibre, etc.)

### Funnel
- Vista kanban horizontal
- Contador por etapa
- Porcentaje de conversión entre etapas calculado automáticamente

### Inventario
- Tipos: Propio, Consignación, Aliado, Retoma
- Estados: Disponible, Reservado, Vendido
- Campos: marca, modelo, año, precio, comisión %, km, color, combustible, fecha ingreso
- Para Consignaciones: nombre y teléfono del dueño
- Alerta visual si lleva más de 30/60 días en inventario
- Vista de leads interesados por vehículo
- Alerta "si bajas el precio avisa a X leads" cuando hay interesados

### Retomas
- Valor de compra + gastos adicionales detallados = inversión total
- Precio esperado → rentabilidad esperada
- Precio venta real → rentabilidad real
- Participantes con porcentaje (ej: Simón 20%, Roberto 30%, aliado 50%)
- Cálculo automático de ganancia por participante

### Búsquedas activas
- Registro de clientes que buscan un vehículo específico
- Match automático si existe en inventario disponible dentro del presupuesto

### Ventas
- Vehículo seleccionado del inventario → al guardar, cambia estado a "Vendido"
- Lead comprador → al guardar, cambia rol a "Cliente"
- Días de venta calculados automáticamente (fecha ingreso → fecha venta)
- También permite registrar ventas de vehículos de aliados (fuera del inventario propio)

### Actividades
- Calendario mensual visual
- Integra tareas de leads + actividades manuales + cumpleaños
- Un clic = seleccionar día, ver actividades de ese día

### Contenidos
- Calendario mensual visual de posts
- **Un clic = seleccionar día. Doble clic = crear nuevo post** (igual que en Actividades)
- Múltiples posts por día
- Cuentas disponibles: `@exotics_colombia`, `@exoticsco_autos`, Ambas
- Tipos: Reel, Carrusel, Story, Post, Video
- Estados: Idea, En producción, Publicado (con código de color)
- Campo de vehículo asociado y copy/ideas

### Finanzas
- Tipos: Ingreso, Egreso, Reembolso pendiente
- Filtro por persona: Simón / Roberto / Empresa / Todos
- **Filtros de fecha rápidos:** Hoy, Semana, Mes, Trimestre, Año
- **Filtro de fecha manual:** Desde → Hasta
- Filtro por tipo (ingresos/egresos/reembolsos)
- Categorías: Venta, Comisión, Publicidad, Operativo, Nómina, Viáticos, Herramientas, Reembolso, Otro
- Balance automático para el período filtrado

---

## 6. Configuración de Supabase

- **Proyecto:** exotics-crm
- **URL:** guardada en `.env` como `VITE_SUPABASE_URL`
- **Anon Key:** guardada en `.env` como `VITE_SUPABASE_ANON_KEY`
- **Tabla principal:** `crm_state` (1 sola fila con todo el estado en JSON)
- **Auth:** Email habilitado, "Confirm email" desactivado, "Enable Signups" desactivado
- **Usuarios creados con Auto Confirm:** Simón y Roberto
- **Repositorio de GitHub conectado:** `simonortega99/exotics-crm`
- **Row Level Security (SQL ejecutado):**
```sql
drop policy if exists "crm_state_all" on public.crm_state;
create policy "crm_state_auth" on public.crm_state
  for all to authenticated using (true) with check (true);
```
Esto garantiza que solo usuarios autenticados pueden leer/escribir datos.

---

## 7. Integración con Google Sheets

- Script en Google Apps Script conectado mediante webhook
- URL guardada en `.env` como `VITE_SHEETS_WEBHOOK_URL`
- Sincroniza contactos e inventario en bloque (~2s de delay)
- Si la variable de entorno no existe, la función simplemente no se activa (no rompe nada)
- Las hojas se llaman `Contactos` e `Inventario` dentro del Google Sheet

---

## 8. GitHub y Vercel

- **Repositorio:** `github.com/simonortega99/exotics-crm` (privado)
- **Branch principal:** `main`
- **Deploy:** Vercel, conectado a `main` — **redespliega automáticamente** con cada `git push`
- **Variables de entorno en Vercel:** las 3 del `.env` están configuradas
- **URL en producción:** la que dio Vercel al hacer deploy (ej: `exotics-crm.vercel.app`)

### Flujo de actualización

Cada vez que Claude Code hace cambios y se confirman, subir con:
```bash
cd "/Users/simon/Documents/EXOTICS CO/CRM/exotics-hq"
git add -A && git commit -m "descripción del cambio" && git push
```
Vercel detecta el push y republica solo en 1-2 minutos.

### Si se daña el Mac
- El código está en GitHub ✅
- Los datos están en Supabase ✅
- La app sigue corriendo en Vercel ✅
- Roberto puede seguir trabajando ✅
- **Único riesgo:** el archivo `.env` local — guardar las 3 variables en un lugar seguro (Apple Passwords, 1Password)

---

## 9. Pendientes / Próximos pasos

- [ ] **Sistema de roles** (Admin vs Asesor): definir qué puede hacer cada uno → implementar tabla `perfiles` en Supabase con campo `rol`
  - Decisión pendiente: ¿Admin puede ver finanzas? ¿Solo admin puede eliminar registros?
- [ ] **Calendarios visuales** en Actividades y Contenidos: ya existen en el Artifact original, pendiente portarlos completamente al proyecto React
- [ ] **Dominio propio** `hq.exoticsco.com` → Vercel Settings → Domains (opcional, cuando quieran)
- [ ] **Asesores externos**: cuando haya asesores de ventas, crear sus usuarios en Supabase y definir qué ven/no ven

---

## 10. Notas técnicas importantes

- Archivos `Icon` de macOS rompen `npm run build` — solución: `rm -rf dist` antes de compilar en producción (no afecta `npm run dev`)
- La anon key de Supabase es visible en el navegador — es normal. La seguridad real la da el Row Level Security (SQL del punto 6)
- `npm run dev` → levanta la app en `http://localhost:5173` para desarrollo local
- El `.env` nunca debe subirse a GitHub (está en `.gitignore`)
- HashRouter fue elegido sobre BrowserRouter para compatibilidad con Vercel sin configuración extra

---

## 11. Cómo trabajar con Claude Code

Claude Code tiene acceso directo a todos los archivos del proyecto. Para cada mejora:

1. Describir el cambio en lenguaje natural (no necesitas saber código)
2. Claude Code lee los archivos, propone los cambios, los aplica
3. Probar localmente con `npm run dev`
4. Si funciona bien, subir a producción: `git add -A && git commit -m "..." && git push`

**Ejemplos de peticiones directas que funcionan bien:**
- *"Agrega un campo de 'presupuesto máximo' al formulario de búsquedas activas"*
- *"En el dashboard, muestra cuántos posts fueron publicados este mes"*
- *"Cambia el color del termómetro 'Caliente' a un rojo más vivo"*
- *"Migra el store a Supabase para que Simón y Roberto compartan datos en tiempo real"*
- *"Agrega autenticación: pantalla de login antes de ver el CRM"*

