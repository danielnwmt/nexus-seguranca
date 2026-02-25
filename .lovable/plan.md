

## Plan: Clean Mock Data, Default Admin User, and Mobile App Integration Section

### What will change

1. **Mock Data (`src/data/mockData.ts`)** — Remove all mock clients, cameras, alarms, guards, and invoices. Leave empty arrays so the app starts clean.

2. **Settings — Users (`src/pages/Settings.tsx`)** — Remove the two extra operators (Operador 01, Visualizador), keeping only the Administrador (admin@bravo.com, Admin level). Add a password field to the user form dialog for when creating/editing users (default admin password: 1234).

3. **Settings — New "Mobile" Tab (`src/pages/Settings.tsx`)** — Add a new tab called "App Mobile" in the Settings page with:
   - Instructions for integrating the mobile app (PWA install or Capacitor)
   - A toggle to enable/disable PWA mode
   - QR Code placeholder or URL display for mobile access
   - Download/install instructions for Android and iOS

4. **Dashboard (`src/pages/Index.tsx`)** — Will naturally show zeros/empty state since mock data is cleared.

### Technical details

**mockData.ts changes:**
```typescript
export const mockClients: Client[] = [];
export const mockCameras: Camera[] = [];
export const mockAlarms: Alarm[] = [];
export const mockGuards: Guard[] = [];
export const mockInvoices: Invoice[] = [];
```

**Settings.tsx — Users default state:**
- Only keep `{ id: '1', name: 'Administrador', email: 'admin@bravo.com', level: 'admin', active: true }`
- Add password field to `SystemUser` interface and user form dialog

**Settings.tsx — New "App Mobile" tab:**
- New tab with `Smartphone` icon from lucide-react
- Card showing the system URL for mobile access
- Toggle for PWA installation mode
- Copy-to-clipboard button for the app URL
- Instructions section for Android and iOS installation

### Files to modify
- `src/data/mockData.ts` — clear all arrays
- `src/pages/Settings.tsx` — remove extra users, add password field, add Mobile tab

