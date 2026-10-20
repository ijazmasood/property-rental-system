# Landlord Desk

Landlord Desk is a static UK property-management demo with an admin dashboard and a tenant app sharing one sample dataset. It uses Bootstrap 5.3, Bootstrap Icons, vanilla JavaScript ES modules, and Chart.js on the admin dashboard. There is no build step or backend.

## Run the demo

Serve the repository root with any static web server. Do not open `index.html` with `file://`: the apps load JSON and JavaScript modules with HTTP requests.

- In VS Code, install/use Live Server and choose **Open with Live Server** on `index.html`.
- Or, from the repository root, run `py -m http.server 8000` and open <http://localhost:8000/>.

Use the landing page to open the [Admin Dashboard](./admin/index.html) or [Tenant App](./tenant/index.html). The CDN links require an internet connection.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Landing page linking to both apps |
| `admin/` | Admin shell, styles, shared live-system badge, and one module per dashboard page |
| `tenant/` | Tenant shell, responsive styles, and one module per tenant screen |
| `data/` | JSON sample collections, the shared store, date/currency/status helpers, and a data-layer check page |
| `assets/` | Shared static assets |
| `docs/` | Product and data specifications |

Both applications use `data/store.js` for collection reads and writes. The initial data is loaded from `data/*.json`; changes are saved as a same-origin `localStorage` overlay so they are shared between the admin and tenant apps in the same browser profile. Use either app's **Reset demo data** action to clear the overlay and restore the JSON sample data.

### Data-layer check

Open `/data/test.html` through the web server to load all collections through the store, display record counts, and show sample UK currency/date/status formatting. Status calculations use `config.demoToday` (`21/10/2026`), not the computer's current date.

## Tenant app layout

On a desktop, the tenant app is presented inside a virtual phone frame. On narrow screens, the frame expands to fill the viewport. The app has a top bar, a five-item bottom navigation (Home, Payments, Issues, Documents, More), a Contracts screen reachable from Home and More-related links, and a light/dark appearance toggle on More.

The login screen is a demo account chooser, not real authentication. Aisha Khan (`t1`) is preselected and has rent history, an upcoming rent item, an issue, a contract, notifications, and documents available in the demo.

The admin user menu and clickable sidebar profile footer both open the current demo role's profile details. The menu's **Sign out** action returns to the landing page; because this is a static demo, it does not revoke a real session. A floating **Ask AI** bubble is available from the admin workspace; it provides read-only answers from the same demo data as the full AI Assistant page.

## Cross-app workflow test guide

Open the admin and tenant apps in separate tabs in the **same browser profile** so both tabs see the same local storage overlay. Use the demo date shown in the apps.

1. **Rent payment:** Sign in as Aisha, open Payments, and pay her upcoming rent using the fake card form (for example `4242 4242 4242 4242`, expiry `12/30`, CVC `123`). In Admin → Rent and Payments, confirm the rent item is paid and the payment is listed. Admin → Accounts shows the two linked ledger entries; the admin notification list shows the payment notice.
2. **Issue and reply:** In Tenant → Issues, report an issue. In Admin → Issues, open it, change its status and add a team comment. Return to the tenant issue details to see the status and comment, and check the tenant notification.
3. **Join request:** From the tenant login screen, send a request to join a property. In Admin → Tenant Requests, approve it and confirm the request is approved and a tenant, user, initial rent schedule, notifications, and audit entry are created. If the selected property already has an active tenant, the new tenancy is deliberately created with `pending` status; it will not appear among active demo login choices until it becomes active.
4. **Contract:** In Admin → Contracts, send a draft contract. Sign in as the matching active tenant, open Contracts, review the agreement and approve it using the tenant's full name and confirmation checkbox. Confirm the approved status in Admin → Contracts and the admin notification.
5. **Tenant document upload:** In Tenant → Documents, upload a sample PDF or image. The demo stores the filename and metadata only. Confirm it appears in Admin → Documents with its tenant and property.
6. **Property document expiry:** In Admin → Documents, edit a property-level certificate's expiry date. Return to the tenant's Documents screen and confirm its status badge is recalculated from `demoToday`.

Payment processing, login, secure file storage, electronic signatures, external notifications, AI services, Open Banking, and scheduled jobs are simulated. The app labels these with the shared **Needs live system** badge; no money, external message, legal signature, or file content is transmitted.

## Store-to-API migration map

The endpoint names below are suggested backend interfaces, not live services. The store functions are the boundary to replace when connecting a backend.

| Store function | Current demo behavior | Suggested future API endpoint |
| --- | --- | --- |
| `loadAll()` | Fetches every JSON collection and overlays saved demo changes | `GET /api/bootstrap` (or parallel collection `GET` endpoints) |
| `get(collection)` | Returns a cloned collection from the overlay or JSON baseline | `GET /api/{collection}` |
| `save(collection, items)` | Replaces a collection in the local overlay and notifies open app tabs | `PUT /api/{collection}`; use resource-specific `POST`/`PATCH` endpoints for domain writes |
| `resetDemo()` | Clears the local overlay and restores sample JSON data | `POST /api/demo/reset` (admin/demo-only operation) |

`get` and `save` currently operate on whole collections to keep this static demo small. A production backend should use authenticated, resource-level operations, server-side validation and authorization, and transactional writes for workflows such as rent payment recording.

## Assumptions and demo limits

- All dates and date-derived statuses use `config.demoToday`; displayed dates and currency follow UK formats.
- An approved request for an already occupied property is recorded as a pending tenancy rather than displacing its current tenant.
- Uploaded documents and issue photos retain filenames/metadata only; files are not uploaded to a server.
- Tenant account selection and typed contract approval are demo simulations, not authentication or legally binding signatures.
