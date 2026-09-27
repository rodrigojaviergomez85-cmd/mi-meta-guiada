# Mi Progreso Diario

Build a mobile-first web app called **"Mi 411"** — a personal goals tracker for one user (Rodrigo). It replaces an Excel sheet where every week he duplicates a tab, names it with the date, and edits his goals. UI language: **Spanish**. Use Supabase (free tier) for auth and database. Do not add any paid service, AI feature or third-party API.

## 1. Auth
- Email + password login with Supabase Auth. Single user. Sign-up allowed only once (first user); after that hide the sign-up option (or leave a simple sign-up but rely on RLS).
- Stay logged in (persist session). Simple login screen with app name and logo placeholder.

## 2. Data model (Supabase, with Row Level Security so each user only sees their own rows)

**profiles**
- id (uuid, = auth user id), name (text, default "Rodrigo Galdamez"), core_values (text, default "1) Serve  2) Protect  3) Kaizen  4) Golden Rule  5) Great Attitude").

**snapshots** — one row per "week tab" (the equivalent of an Excel tab)
- id (uuid), user_id, label (text, free text like "9.06.26" — this is what the user sees; NO calendar picker required), snapshot_date (date, default today, used only for sorting), month_label (text, e.g. "SEPT"), week_label (text, e.g. "7-12 SEPT"), annual_label (text, default "31/DIC/2026"), is_current (boolean), created_at, updated_at.

**goals** — 45 rows per snapshot
- id (uuid), snapshot_id, company (enum: 'personal' | 'e4cc' | 'e4kids'), level (enum: 'annual' | 'monthly' | 'weekly'), position (int 1–5), text (text), done (boolean default false), updated_at.
- Unique constraint on (snapshot_id, company, level, position).

## 3. Screens

### 3.1 Home (after login)
- Header: app name "Mi 411", the user's name, and the **Core Values** line in small text (editable by tapping it → inline edit).
- Current snapshot bar: shows "Semana: {label}" and "Actualizado: {updated_at}" with a pencil icon to edit the label / month / week text inline.
- **Three big cards** stacked vertically on mobile (side by side on desktop), in this order: **Personal**, **E4CC**, **E4Kids**. Each card shows the company name, a color (Personal = green, E4CC = orange, E4Kids = blue), and a progress summary: "X/15 metas completadas" for the current snapshot.
- Tapping a card opens the Company screen.
- Primary button (floating on mobile, top-right on desktop): **"Nueva semana"**.
- Secondary link: **"Historial"**.

### 3.2 Company screen (e.g. /e4cc)
- Back button + company name with its color.
- Three sections, each collapsible, default all expanded:
  1. **Metas anuales — {annual_label}**
  2. **Metas mensuales — {month_label}**
  3. **Metas semanales — {week_label}**
- Each section lists positions 1–5. Each row = number badge + checkbox (done) + the goal text.
- **Inline editing**: tap the text → it becomes a multiline textarea (auto-growing, no character limit) → **autosave** on blur or after 800 ms of no typing; show a small "Guardado ✓" toast/indicator. Enter key inserts a newline; there's no need to press a save button. Long texts must wrap fully (never truncate).
- Checkbox toggles `done` immediately; done rows show the text with a subtle strikethrough + muted color.
- On mobile add a sticky bottom tab bar to jump between Personal / E4CC / E4Kids without going back home.
- On desktop (≥1024px) show a **"Vista completa"** toggle that renders all three companies as three columns (Personal | E4CC | E4Kids), each with its annual/monthly/weekly sections — replicating the Excel layout. Editing works the same in this view.

### 3.3 "Nueva semana" flow
- Opens a small dialog: label (text input prefilled with today's date formatted M.DD.YY, e.g. "9.27.26"), week_label (text, prefilled empty), month_label (prefilled with the current month abbreviation in Spanish, e.g. "SEPT"). No date picker — just text fields.
- On confirm: create a new snapshot, set it as `is_current` (unset the previous one), and **copy all 45 goals** from the previous current snapshot with `done` reset to false. Then navigate to Home showing the new snapshot.
- Old snapshots are never modified by this action.

### 3.4 Historial
- List of all snapshots, newest first: label, week_label, month_label, date, and "X/45 completadas".
- Tapping one opens it in **read-only** mode (same layout as Home/Company but with a banner "Viendo semana anterior — solo lectura" and a button "Volver a la semana actual"). Optional: a button "Hacer actual" to reopen an old snapshot for editing (with confirmation).
- Swipe/long-press or a menu on each row: **Eliminar** (with confirmation) and **Editar etiqueta**.

## 4. Design
- Clean, minimal, generous tap targets (min 44 px), large readable text (16–18 px body). Rounded cards, soft shadows, plenty of white space. Light theme by default; support dark mode via system preference.
- Colors: Personal `#16a34a`, E4CC `#f97316` (orange, matching the E4CC brand), E4Kids `#0ea5e9`. Neutral gray background.
- Fully responsive: phone (single column), tablet, desktop (three columns). No horizontal scrolling on phone.
- Make it installable as a PWA (manifest + icons) so it can be added to the phone home screen.

## 5. Seed data
On first login, if the user has zero snapshots, create one snapshot with label **"9.06.26"**, month_label **"SEPT"**, week_label **"7-12 SEPT"**, annual_label **"31/DIC/2026"**, is_current = true, and insert these 45 goals exactly (done = false):

### Personal — annual
1. acepto la voluntad de Dios en mi vida, fluyo, escucho a la vida, y sirvo de Corazon
2. ayudo a los necesitados, becas, asilos, orfanatos y escuela emprendedores
3. estoy fit, sano y atleta alto rendimiento 9% body fat
4. Genero $25,000 ingreso pasivo de mis inversiones, invierto 3m
5. ser feliz en el amor conmigo, NAMASTE, CONMIGO Y TODOS

### Personal — monthly
1. meditar 2 veces al dia, pidiendo Dios tome el control 4.10-4.30am mediodia 12.10-12.30md
2. AYUDA PRESUPUESTO MENSUAL A COLABORADORES Y OTROS
3. comer saludable hacer menu para la semana cena, salpicon, train hard, no cheats till Saturday, sleep 7.30pm
4. venta propiedades ineficientes y analisis compra propiedades de $300-$500
5. hacer namaste todos los dias

### Personal — weekly
1. meditar 2 veces al dia, pidiendo Dios tome el control 4.10-4.30am mediodia 12.10-12.30md
2. fondo financiero de alivio
3. comer saludable hacer menu para la semana cena, salpicon, train hard, no cheats till Saturday, sleep 7.30pm
4. venta de propiedades y analisis financiero mio
5. hacer namaste

### E4CC — annual
1. Rentabilidad Anual 15%
2. Customer's NPS 92%, llegar B2+
3. Team member's NPS 92%
4. 17 million sales
5. A players en toda gerencia

### E4CC — monthly
1. fix evaluations system + game plan individual + new curricula
2. AI PREZIS y clases, fix intermedios repitentes, y monotono y aburrido clase y tarea, BET/WELL/WRITING, increase task complexity, zero passiveness in AF + Evaluations Team
3. read and action plan plus missing one on ones with academic and sales team
4. add ons?? Light course / ultra light course 24.99 a month / 29.99 private
5. DOMINATE BACHILLERES 6/10 SE INSCRIBAN CON NOSOTROS

### E4CC — weekly
1. TIKTOK BACHILLERES
2. implement BET/WELL + EVALUATION SYSTEM CALIBRATIONS + GAME PLAN BOTTOM STUDENTS
3. leer csat
4. NEW PRICES AND NEW INBOX FLOW
5. leadership training books to read / senior recruiter

### E4Kids — annual
1. Rentabilidad 23%, increase retention by 20%
2. Customer's NPS 92%, llegar B1+ solido
3. Team member's NPS 92%
4. 20m
5. A PLAYERS en toda gerencia

### E4Kids — monthly
1. SLOW PROGRESS NO RESULTS / WEEK 2 QA / REPETITIVE CONTENT: FIX FIRST 8 MONTHS CURRICULA REDESIGN, NEWER ACTIVITIES / MONTHLY AND WEEKLY EVALUATIONS AND CURRICULA REDESIGN / QA DE TODAS LAS LINEAS (si tengo JRS y KIDS me monitoreas las dos) / TRAINING LOW PARTICIPATION, COACH TALKING TIME / WALL OF FAME
2. AI PREZIS y clases, EPIC AF y new evo flow, WELL/BET + writing + AF variations and completely new flows + videos de progreso
3. evaluation calibration with coaches
4. 5 audits
5. push for SV influencers, muppies

### E4Kids — weekly
1. QAS WEEK
2. IMPLEMENT BET/WELL + MONTHLY EVAS + GAME PLAN BOTTOM STUDENTS
3. leer csat y exit + severance pay
4. GAMES IN PLATFORM, EPIC CURRICULUM
5. leadership school, propuesta aumento, data analyst, 12 books to read, curricula manager, recruit 5 F leaders

## 6. Non-negotiables
- Everything saves to Supabase automatically; never lose an edit (optimistic UI + retry on failure, show an error toast if saving fails).
- Works offline-tolerant: if the network drops mid-edit, keep the text locally and retry.
- No paid services, no AI APIs, no analytics SDKs.
- Keep the code simple: React + Tailwind + shadcn/ui + Supabase client. One route per screen: `/login`, `/` (home), `/c/:company`, `/historial`, `/historial/:snapshotId`.

Start by creating the Supabase tables with RLS, then the login, then Home and Company screens with inline editing, then "Nueva semana", then Historial, then the desktop three-column view and PWA.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mi-meta-guiada.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c594a7d7-0fee-492d-a66f-9d2737aad80f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
