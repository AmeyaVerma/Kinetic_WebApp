# Kinetic Line Logistics ERP — Project Status Document

**Prepared:** July 2026 (last refreshed 20 Jul 2026)
**Repo:** [github.com/AmeyaVerma/Kinetic_WebApp](https://github.com/AmeyaVerma/Kinetic_WebApp) · Deployed on Vercel
**Scope of this document:** everything built to date, the technology used, how source documents map to code, and what remains.

---

## 1. What this project is

A web-based Logistics ERP purpose-built for **Kinetic International Logistics Pvt. Ltd.** ("Kinetic Line"), a Mumbai-based NVOCC and freight-forwarding operator. It replaces WhatsApp groups, an Excel shipment tracker, and disconnected email threads with **one platform where every team and every external party — Ops, Finance, Sales, MNR, HR, customers, and overseas agents — work on the same live shipment record.**

The project is entirely separate from the company's marketing website (a different repo, `kit2`) — no code, files, or history are shared between the two.

### Build philosophy
The application was built **UI-first**: every module is a fully clickable, production-styled interface running on realistic seed data (including genuine data pulled from the company's own operational tracker), backed by an in-memory Zustand store standing in for a database. This lets every workflow, approval gate, and business rule be demonstrated and validated *before* any backend engineering begins. The data layer was deliberately designed as a single swappable module (`src/lib/api.ts` + per-feature Zustand stores) so that replacing mock data with real Supabase queries later requires no changes to any screen.

---

## 2. Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **React 19** + **TypeScript** | Strict typing throughout; no `any` in domain models |
| Build tool | **Vite 8** | Dev server + production bundler |
| Routing | **React Router 7** | Client-side routing, nested layouts, route guards |
| State management | **Zustand 5** | Three stores: `useDataStore` (all business data), `useAuthStore` (session/RBAC), `useUiStore` (theme/sidebar) |
| Styling | **Tailwind CSS 3** | Utility-first, fully tokenized to the design system |
| Icons | **Lucide React** | Consistent icon set across the app |
| Fonts | **Fontsource** (self-hosted) | Archivo (display), Inter (body), IBM Plex Mono (codes/refs) — no external font CDN calls |
| Type checking | **TypeScript 6 (tsc -b)** | Runs as part of every production build |
| Linting | **oxlint** | Fast Rust-based linter |
| Hosting | **Vercel** | Auto-deploys from `main`; SPA rewrite configured (`vercel.json`) so client-side routes don't 404 |
| Planned backend | **Supabase** (Postgres + Auth + Row-Level Security + Storage) | Not yet connected — see §6 |
| Planned integration | **Zoho Books REST API** | Simulated today (sync-status chips), real integration pending |

**Codebase size today:** 61 TypeScript/TSX files, ~18,900 lines of code, 13 commits on `main`.

> Note: the Recharts library previously powered the standalone Dashboard's line/donut charts. That page has since been removed (see §5.1), so charts are no longer rendered anywhere; per-module KPI tiles replaced them.

---

## 3. Source documents used

Every module was built directly from a written specification supplied during the project, not improvised. These are the source-of-truth documents:

| Document | Module(s) it drove |
|---|---|
| `Kinetic-Line-ERP-Product-Reference.docx` (v5) | Original platform scope, brand identity, module list, phased roadmap |
| Dashboard reference image (emerald/white palette) | Overrides the doc's navy/teal branding — the palette actually implemented |
| `Kinetic-Line-Workflow-v3.html` | NVOCC + Freight Forwarding + Agency + Empty Yard flowcharts (26 sections) |
| `Kinetic-MNR-Module-Requirements-v2.docx` + `Kinetic-MNR-Flowchart.html` | MNR (Maintenance & Repair) — 5 flows |
| `Kinetic-FF-Module-Requirements-v2.docx` + `Kinetic-FF-Flowchart.pdf` | Freight Forwarding — 6 flows |
| `Kinetic-Customer-Management-Requirements-v1.docx` + flowchart PDF | Customer Management module |
| `Kinetic-Agent-Management-Requirements-v1.docx` + flowchart PDF | Agent Management module |
| Business Solution export tracker (`.csv`, multiple pulls) | Real NVOCC booking data (24 bookings) + real MNR fleet inventory (333 containers) |
| Web research (HR-ERP best practices + Indian statutory leave law) | HR module — no written spec existed; design was research-driven |
| User-directed design session | Role-based access control, login flow, Admin Users & Roles feature |
| Handwritten refinement notebook (17-item punch list, Jul 2026) | The cross-cutting UX + data-extensibility pass — per-module dashboards, single "Rate" costing, CSV export, editable dates, manual booking status, addable dropdowns, custom fields, roadmap relocation, scroll fixes (see §5.1, §5.2, §5.10) |

---

## 4. Design system

A locked, documented token set (see `src/pages/DesignSystemPage.tsx` for the live reference page):

- **Background** `#FAFBFC` (never pure white) · **Cards** `#FFFFFF` · **Secondary surface** `#F5F7FA` · **Border** `#E8EDF3` (1px only)
- **Primary** Emerald `#10B981` (hover `#059669`) · **Accents** Blue `#3B82F6`, Purple `#8B5CF6`, Orange `#F59E0B`, Coral `#EF4444`, Teal `#14B8A6`
- **Typography** Archivo (headings) · Inter (body) · IBM Plex Mono (all booking refs, BL numbers, container numbers)
- **Radii** Cards 20px · Buttons 12px · Inputs 16px · Badges 999px (pill)
- **Shadow** `0 4px 20px rgba(15,23,42,.05)` — the "floating card" look
- **Status chips** — a fixed vocabulary (Booked, In Transit, Documentation, Delivered, Cancelled, Draft, Pending, Overdue) each with a dedicated tint/text pair, reused identically across every module
- **Dark mode** — a complete parallel token set (`#0F172A` background, `#162032` cards, `#34D399` primary), driven by both `prefers-color-scheme` and a manual toggle stamped as `data-theme`

---

## 5. What has been built — module by module

### 5.1 Foundation & shell
- App shell: white sidebar (nav filtered by role — see §5.9), sticky frosted top bar (search, notifications, user menu), responsive mobile drawer, light/dark toggle
- **Per-module dashboards** (replaced the standalone global Dashboard): every module page now opens with its own live KPI tile row computed from that module's real data — NVOCC (bookings, in-transit, delivered/arrived, BL drafts, open leads), Freight, MNR, HR, Customers, Agents — via one shared `StatKpi` component. The old aggregate Dashboard page, its route, its sidebar entry, and its mock-chart data layer were removed; internal users now **land on NVOCC** after login (each role still lands on its own primary module).
- Design-system reference page (`/design-system`)

### 5.2 NVOCC (`/nvocc`)
*Source: Workflow v3, §0.5–§11*

- **Lead → Quote → Booking funnel**: lead capture (including walk-in customers with no master record), quote builder with automatic margin-threshold routing to manager approval, one-click conversion of an accepted quote into a booking
- **2-step New Booking wizard**: full header (customer, shipper/consignee, both agents, vessel master with auto-fill of POL/POD/ETD/ETA, free days, transit time) + a costing grid. **The buy side was removed** — NVOCC now captures a single customer-facing **"Rate"** line per charge (buy vs. sell only remains in Freight Forwarding, which genuinely needs both); the wizard and the Invoicing tab both show a "Rate total" rather than a gross-profit calc
- **8-tab booking record**: Container info · Product info · Shipment details · Agent details · Container yard · Container activities · Invoicing · Documents
- **Editable shipment dates**: ETD/ETA on the Shipment details tab are editable (manual typing *or* the native calendar picker), saved on blur and written to the activity log
- **Computed cycle + manual operational status** (two distinct concepts that coexist): cycle-% progress is still *never* set manually — derived from a 22-step export / 9-step import milestone checklist (`src/lib/milestones.ts`). Alongside it, a **manual booking-status dropdown** (Booked / In Progress / Cancelled / Back to Town / Hold, config-driven in `src/lib/bookingStatus.ts`) lets Ops set the operational status by hand, and a **"Latest update"** line surfaces the most recent activity-log entry. Setting status to Cancelled voids the booking and vice-versa
- **Lifecycle roadmap**: a horizontal stage stepper (Booked → Container allocated → Documentation → … → Closed, direction-aware) on the booking header, driven by the milestone-computed status. This roadmap was **relocated from the Freight Forwarding detail view** (see §5.4) into a reusable `StageStepper` component and re-fed with NVOCC's own lifecycle
- **CRO workflow**: generate → issue → confirm pickup (auto-logs gate-out + milestone)
- **BL (Bill of Lading) engine**: three edit paths (Ops direct-and-versioned, Agent live-and-versioned, Customer approval-gated), full version history, lock-on-approval, Original/Telex/Seaway release, formal amendment cycle after lock
- **Real data**: all 24 seed bookings are the company's actual tracker records (`src/mocks/nvoccSeed.ts`), including real vessel names, terminals, container numbers, and HBL numbers; new bookings continue the real `KLNVO2627xxxxxx` numbering scheme
- **User-extensible fields**: the booking flow is also the first home of the addable-dropdown-options and custom-field-builder features — see §5.10

### 5.3 MNR — Maintenance & Repair (`/mnr`)
*Source: MNR Requirements v2 + flowchart (5 flows)*

- **Flow 1 (Gate-in & Inspection)**: OCR/booking match with manual-override audit trail, import seal-integrity check (raises cargo-claim event on failure), hard-blocking minimum-6-photo + signed-EIR gate, 6-item structural checklist, CSC-expiry <90-day flag, cleanliness routing, reefer PTI test, contamination block; an all-pass inspection fast-paths straight to "Available"
- **Flow 2 (Damage Survey & Estimate)**: per-panel damage points with IICL-style codes, dimensions, severity, hard-blocking minimum-2-photo gate, pre-existing-vs-new classification, vendor estimate worksheet with 15-day validity and mandatory-reason revisions
- **Flow 3 (Approval Engine)**: value-band routing matrix (<$300 auto-approve / $300–1,500 Depot Supervisor / $1,500–5,000 MNR Manager / >$5,000 Regional Head + Finance dual sign-off), mandatory Engineering sign-off on structural damage, 48-hour lessor-notification SLA on leased containers — routed through the shared Approvals queue
- **Flow 4 (Repair & QC)**: live progress tracking, >10% material-deviation alert, mid-repair "Additional Damage Request" that re-enters the approval engine as a delta while approved lines continue, per-line QC pass/fail with a not-billable rework loop on failure, mandatory CSC re-certification after structural repair and repeat PTI after reefer repair, punch-list tracking
- **Flow 5 (Finance & Close)**: vendor-bill-vs-estimate variance matching (>10% routes to Approvals), automatic customer debit-note drafting for customer-caused damage (via the shared invoicing engine), independent warranty-claim tracking, capitalize/expense cost classification, three closure outcomes (Available / Off-Hire / Scrap — with a 70%-of-insured-value total-loss trigger)
- **Fleet master**: seeded with **333 real containers** imported directly from the company's Business Solution tracker export, including real container numbers, ownership, ISO types, and 7 real depot locations; searchable/filterable fleet table

### 5.4 Freight Forwarding (`/freight`)
*Source: FF Requirements v2 + flowchart (6 flows)*

- **Multi-vendor buy vs. single sell**: one costing line per vendor role (carrier, customs, trucking, warehousing, insurance) against one consolidated client-facing sell price — structurally distinct from NVOCC's single buy/sell pair
- **Credit gate**: bookings exceeding a customer's credit limit are held pending Finance sign-off through the shared Approvals queue
- **Carrier linking**: a shipment can link internally to a live NVOCC booking as its "master," auto-subscribing to its milestones, or record an external carrier confirmation
- **House + Master document set**: SI intake, weight-variance flagging, MBL/MAWB upload, HBL/HAWB auto-draft with the same three-path edit model as NVOCC's BL, and release locking
- **Export/import operational flow**: broker assignment, customs hold/resolve, cut-off tracking with a missed-cut-off re-plan loop, departure/SOB, arrival notice, Bill of Entry, Out-of-Charge, Delivery Order, POD capture
- **Estimated → Actual GP**: profit shows as "Estimated" until every independently-arriving vendor bill is matched (>10% variance routes to Approvals); flips to "Actual" only when fully reconciled; financial closure is blocked until then
- **LCL consolidation**: parent booking represents one physical container; child HBLs (one per shipper) each carry their own client, sell price, and P&L; container-level costs are apportioned across children by revenue share on run-close; children then close financially on independent timelines
- **Note:** the horizontal stage-stepper roadmap that used to sit at the top of the FF shipment detail was **removed from FF and relocated to the NVOCC booking record** (per the refinement notebook). FF retains its per-stage operational panels and the list-view Stage column; it no longer renders the stepper

### 5.5 Customer Management (inside **Customer Portal**, `/portal/customer`)
*Source: Customer Management Requirements v1 + flowchart*

- **7-tab record**: General/Company Info · Contacts · Commercial Terms · Access & Portal Configuration · Notifications · Documents & Compliance · Audit Log
- **Onboarding gate**: a Prospect auto-flips to Active only when all four conditions are simultaneously true — KYC verified, sanctions screening Clear, credit approved (or cash-in-advance), Sales sign-off recorded
- **Commercial terms**: default Incoterm, payment terms, credit-hold policy (hard-block/soft-warn), consolidated invoicing, contracted lane rates; credit-limit changes route through Finance via the shared Approvals queue
- **Access & Portal Configuration**: master portal on/off switch, per-module visibility, three-tier BL-edit permission, document-download scope, booking-creation and quote-request toggles, portal-user management with roles
- **Notification matrix**: event type × channel × digest-frequency, per contact (Customs Hold locked to real-time)
- **Lifecycle**: On Hold (Finance credit control), Inactive (portal auto-suspend), and a **two-person Blacklist** gate — reason code + Regional Head approval, with reversal requiring the identical approval level, logged separately

### 5.6 Agent Management (inside **Agent Portal**, `/portal/agent`)
*Source: Agent Management Requirements v1 + flowchart*

- **8-tab record** (adds Performance & SLA over the Customer model): General · Contacts · Commercial Terms · Access & Portal · Notifications · Documents & Compliance · Performance & SLA · Audit Log
- **Direction field**: "We are Principal" / "We are Agent" / "Both" — the single field that determines which permissions are even relevant (e.g., Create-Booking rights only make sense when the relationship includes "We are Agent")
- **Stricter onboarding**: Regional Head approval required (a higher bar than the Customer module's Sales-Manager sign-off) because Active status immediately grants real booking/document rights
- **Commission**: percentage / flat-fee / tiered-by-volume, configured independently per direction when Direction is "Both"; changes to an Active agent's commission require Finance Head approval
- **Performance scoring**: weighted composite score (on-time %, documentation accuracy, responsiveness) with an admin-configurable auto-flag threshold that creates a review task for the Relationship Owner
- **Lifecycle**: deliberately *fast* one-click Suspension (instant rights revocation, risk-containment tool) vs. deliberately *slow* Termination — blocked outright until the Agency Statement-of-Account reconciles to zero, then requires Regional Head + Finance dual sign-off; historical data remains permanently queryable after termination

### 5.7 HR (`/hr`)
*Source: no written spec — designed from HR-ERP research + Indian statutory leave law*

- **Employee register**: EMP-coded records, department mapped to platform roles, reporting-line hierarchy, 5-stage lifecycle (Onboarding → Probation → Active → On Notice → Exited)
- **Leave engine**: Casual (12/yr, no carry-forward), Sick (12/yr, medical-certificate requirement enforced beyond 2 days), Earned/Privilege (15/yr, carries forward, encashable at exit), Loss of Pay
- **Approval routing**: leave requests flow through the same shared Approvals queue; approval deducts the balance automatically, and any shortfall converts to Loss-of-Pay days that feed the payroll register
- **Gated exit**: an employee cannot be marked Exited until three clearance checks all pass — knowledge handover, asset return, final settlement (including earned-leave encashment)
- **Supporting screens**: 2026 holiday calendar, document expiry tracking, payroll register preview (full payroll processing explicitly scoped as Phase 2)

### 5.8 The shared engine layer
This is the connective tissue that makes the seven modules behave as one system rather than eight bolted-together apps:

- **Universal Approvals queue** (`/approvals`) — a single inbox now carrying **10 distinct gate types**: quotes over margin, customer BL edits, invoice sign-off, MNR repair estimates, mid-repair delta requests, vendor-bill variances, FF credit holds, customer credit-limit changes, customer/agent blacklist actions, agent onboarding/commission/termination gates, and HR leave requests. Approving an item there applies the change back to its source record — it is not a notification feed, it is the actual decision point.
- **Shared invoicing engine** — a single 10-state invoice lifecycle (Draft → Pending approval → Approved → Zoho synced → Emailed → Partially paid → Paid / Overdue / Cancelled) used identically by NVOCC AR/AP invoices, MNR customer recovery debit notes, and Freight Forwarding client invoices
- **Immutable audit log** — every state-changing action across every module writes to a permanent, per-record activity log (actor, timestamp, action) — visible on booking detail pages, customer/agent records, employee records, and the admin audit trail
- **Single swappable data layer** — all business data lives behind `useDataStore` (Zustand) and mock seed files; no component talks to mock data directly, which is what makes the future Supabase migration a data-layer swap rather than a UI rewrite
- **Store-backed master data** — the master lists that feed dropdowns (customers, agents, vessels, vendors, depots, charge codes, container/package types) now live in a `masters` slice inside `useDataStore`, seeded from the mock master files, with an `addMasterOption` action. This both closes a previous single-data-layer gap (master reads used to import the mock files directly) and powers the user-extensible dropdowns in §5.10
- **Custom-field schema** — `customFieldDefs` (global per-entity field definitions) and `customFieldValues` (per-record values) live in the store as a config-driven mini-schema, ready to map onto a Supabase table (see §5.10)
- **CSV export utility** — a shared `downloadCsv` helper + `CsvButton` component export any on-screen table/list to a `.csv` client-side (§5.10)

### 5.9 Authentication & Role-Based Access Control
*Source: user-directed design session, no external document*

- **Login screen** with email/password and a demo sign-in picker (one entry per seeded persona), plus a full **MFA step** enforced for high-privilege roles (Admin, Finance)
- **RBAC matrix** (`src/lib/rbac.ts`) — a single source-of-truth table mapping each of 8 roles (`admin, ops, finance, sales, mnr, hr, customer, agent`) to per-module access (`full / view / none`) across all 13 modules; this same matrix is designed to become the Supabase Row-Level Security policy later — UI filtering today, real enforcement then
- **Route guards** — every internal route is wrapped in a `<Guard>` component that checks effective access and redirects to the user's role-specific landing page if denied
- **Role-filtered sidebar** — navigation items are filtered live from the same matrix; nothing is hidden by CSS, items are not rendered at all if inaccessible
- **Internal vs. external split** — internal staff (`admin/ops/finance/sales/mnr/hr`) get the full ERP shell; external roles (`customer/agent`) are routed to a completely separate, scoped `ExternalPortal` showing only their own bookings — never the internal shell
- **Admin-only "Users & Roles" feature** (`/admin/users`):
  - **Users tab** — full staff/external directory, role reassignment (takes effect immediately, audited), per-user **module-level overrides** (inherit / grant / revoke — lets an admin give one person non-standard access without inventing a new role), suspend/reactivate/remove, invite-new-user flow, self-protection (can't suspend/remove your own account)
  - **Roles & permissions tab** — the live access matrix rendered as documentation
  - **Audit trail tab** — every role and access change, immutable
- **Admin "View as" preview** — lets an admin see the app through another role's eyes without actually re-authenticating or escalating privilege

### 5.10 Cross-cutting UX & data-extensibility pass
*Source: handwritten refinement notebook (Jul 2026)*

A round of platform-wide refinements applied across every module rather than to a single feature:

- **Per-module dashboards** — every module opens with its own KPI tile row (see §5.1); the standalone Dashboard page was retired
- **CSV export everywhere** — a "Download CSV" button sits beside every data table/list across the app (NVOCC bookings/leads/quotes, Freight shipments, MNR jobs + fleet, HR employees/leave/payroll, Customers, Agents, Approvals, Users, and the admin audit trail). Each export respects the current view's active filters and uses human-readable column headers
- **Addable dropdown options (Pass 1 — done)** — a reusable `AddableSelect` component adds an inline **"+"** affordance to master-backed dropdowns: type a new value, it's appended to the store `masters` slice and immediately selected. Live today on the dropdowns whose value is stored **by name/string** on the record (customer, container type, package type, charge code), so newly-added options can never orphan a reference
- **Custom-field builder (Pass 2 — done)** — on the booking record, a **"+ Add field"** control lets a user define an entirely new field (label + type: text / number / date / dropdown-with-options). Definitions are **global per entity** (apply to every booking); values are **per record**. This is the config-driven, tenant-safe schema-extension mechanism intended to become a Supabase table — not hardcoded fields. (`CustomFieldsCard.tsx` + the store's `customFieldDefs`/`customFieldValues`)
- **Auto-scroll to detail** — clicking a row in the Customer Portal, Agent Portal, or MNR repair-jobs list now smooth-scrolls the newly-revealed detail panel into view (previously it opened below the fold with no scroll)
- **Editable shipment dates** and the **manual booking-status dropdown / lifecycle roadmap** described under NVOCC (§5.2) also came from this pass

---

## 6. What is *not* built yet

| Item | Status |
|---|---|
| **Real backend** (Supabase: Postgres, Auth, Row-Level Security, Storage) | Not started. All data is in-memory (Zustand) and resets on page refresh. This is the single largest remaining piece of work. |
| **Real Zoho Books integration** | Simulated only — sync-status chips exist, no actual API calls |
| **Agency module** (Kinetic Line as agent-of-record / principal for other lines, per Workflow v3 §21) | Not started — the platform-wide Agency concept is referenced by Agent Management but not independently built |
| **Empty Yard Management** (Workflow v3 §22 — yard-level stock/gate view) | Not started |
| **Cross-module Container Tracking** (Workflow v3 §24 — one search across all modules) | Not started |
| **Accounts / Finance workspace** (`/accounts`) | Placeholder page only |
| **Master Data screens** (`/master` — 12 entity types) | Placeholder page only. Master lists now live in the store `masters` slice (§5.8) and can be extended inline from dropdowns (§5.10), but there is still no dedicated Master Data CRUD workspace |
| **Addable options for id-referenced masters** | Partial. Name/string-stored dropdowns are addable (customer, container type, package type, charge code). Vessel, agents, depots, and vendors are **not yet** addable — their record resolvers still read the static mock files, so that must be migrated to the store first, and vessel additionally needs a multi-field add form (name/voyage/POL/POD/ETD/ETA). Tracked as the Pass-2 remainder |
| **Custom fields on other entities** | The custom-field builder (§5.10) currently targets the booking record only; the mechanism is entity-generic and can be extended to customers, agents, containers, etc. |
| **Reports module** (`.xlsx` exports via SheetJS) | Placeholder page only |
| **Settings** | Placeholder page only |
| **Full HR payroll processing** | Explicitly scoped as Phase 2 in the product reference; only a read-only register exists today |
| **PDF generation** (BL documents, invoices) | Not started |
| **Email/WhatsApp notifications** | Not started — notification *preferences* are configurable in Customer/Agent Management, but no messages are actually sent |
| **OCR document parsing** | Not started |
| **Mobile app / PWA** | Not started (the web app is responsive, but no native or installable app exists) |

---

## 7. Recommended path forward

1. **Supabase backend integration** — stand up the Postgres schema (mirroring the TypeScript domain types already in `src/lib/types.ts`), wire Supabase Auth to replace the current mock login, and implement the RLS policies directly from the existing `ROLE_MATRIX`. Because the mock data layer was built as a single swap point, this should not require rewriting any screen.
2. **Master Data + Accounts screens** — the two placeholder modules most other modules already assume exist (charge codes, tax codes, vessels, etc. are referenced everywhere via mock master files).
3. **Agency module + Empty Yard + Container Tracking** — the three remaining platform-wide modules named in Workflow v3.
4. **Reports (.xlsx)** — lower effort, high visible value; SheetJS is already listed in the original tech recommendation.
5. **Zoho Books live sync + PDF generation + notifications** — once the backend exists, these become the natural "connect real systems" phase.
