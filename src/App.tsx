import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { BharatConnectPage } from "./pages/settings/bharatconnect/BharatConnectPage";
import { ProfilePage } from "./pages/settings/bharatconnect/profile/ProfilePage";
import { IdsPage } from "./pages/settings/bharatconnect/IdsPage";
import { InvoiceListPage } from "./pages/invoices/InvoiceListPage";
import { InvoiceViewPage } from "./pages/invoices/InvoiceViewPage";
import { InvoiceCreatePage } from "./pages/invoices/InvoiceCreatePage";
import { ContactsListPage } from "./pages/contacts/ContactsListPage";
import { ContactViewPage } from "./pages/contacts/ContactViewPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactViewPage />} />
          <Route path="/settings/bharatconnect" element={<BharatConnectPage />} />
          <Route path="/settings/bharatconnect/profile/*" element={<ProfilePage />} />
          <Route path="/settings/bharatconnect/ids" element={<IdsPage />} />

          <Route path="/sales/invoices" element={<InvoiceListPage kind="sales" />} />
          <Route path="/sales/invoices/create" element={<InvoiceCreatePage kind="sales" />} />
          <Route path="/sales/invoices/:id" element={<InvoiceViewPage kind="sales" />} />

          <Route path="/expenses/bills" element={<InvoiceListPage kind="purchase" />} />
          <Route path="/expenses/bills/create" element={<InvoiceCreatePage kind="purchase" />} />
          <Route path="/expenses/bills/:id" element={<InvoiceViewPage kind="purchase" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
