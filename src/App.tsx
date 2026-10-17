import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { BharatConnectPage } from "./pages/settings/bharatconnect/BharatConnectPage";
import { ProfilePage } from "./pages/settings/bharatconnect/profile/ProfilePage";
import { IdsPage } from "./pages/settings/bharatconnect/IdsPage";
import { InvoiceListPage } from "./pages/invoices/InvoiceListPage";
import { InvoiceViewPage } from "./pages/invoices/InvoiceViewPage";
import { InvoiceCreatePage, InvoiceEditPage } from "./pages/invoices/InvoiceCreatePage";
import { BcBillCreatePage } from "./pages/invoices/BcBillCreatePage";
import { ContactsListPage } from "./pages/contacts/ContactsListPage";
import { ContactViewPage } from "./pages/contacts/ContactViewPage";
import { BankingPage } from "./pages/banking/BankingPage";
import { CatalogListPage } from "./pages/catalog/CatalogListPage";
import { CatalogItemPage } from "./pages/catalog/CatalogItemPage";
import { EmployeeListPage } from "./pages/hrms/EmployeeListPage";
import { AddEmployeePage } from "./pages/hrms/AddEmployeePage";
import { EmployeeDashboardPage } from "./pages/hrms/EmployeeDashboardPage";
import { AttendancePage } from "./pages/hrms/AttendancePage";
import { TaxDeclarationPage } from "./pages/hrms/TaxDeclarationPage";
import { PayrollDashboardPage } from "./pages/hrms/payroll/PayrollDashboardPage";
import { PayrollComputationPage } from "./pages/hrms/payroll/PayrollComputationPage";
import { SalaryPaymentPage } from "./pages/hrms/payroll/SalaryPaymentPage";
import { PayrollReportsPage } from "./pages/hrms/reports/PayrollReportsPage";
import { AdvancedSettingsPage } from "./pages/settings/advanced/AdvancedSettingsPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<ContactsListPage />} />
          <Route path="/contacts/:id" element={<ContactViewPage />} />
          <Route path="/catalog" element={<CatalogListPage />} />
          <Route path="/catalog/:id" element={<CatalogItemPage />} />
          <Route path="/settings/bharatconnect" element={<BharatConnectPage />} />
          <Route path="/settings/bharatconnect/profile/*" element={<ProfilePage />} />
          <Route path="/settings/bharatconnect/ids" element={<IdsPage />} />

          <Route path="/sales/invoices" element={<InvoiceListPage kind="sales" />} />
          <Route path="/sales/invoices/create" element={<InvoiceCreatePage kind="sales" />} />
          <Route path="/sales/invoices/:id/edit" element={<InvoiceEditPage kind="sales" />} />
          <Route path="/sales/invoices/:id" element={<InvoiceViewPage kind="sales" />} />

          <Route path="/expenses/bills" element={<InvoiceListPage kind="purchase" />} />
          <Route path="/expenses/bills/create" element={<InvoiceCreatePage kind="purchase" />} />
          <Route path="/expenses/bills/:id/edit" element={<InvoiceEditPage kind="purchase" />} />
          <Route path="/expenses/bills/:id/create" element={<BcBillCreatePage />} />
          <Route path="/expenses/bills/:id" element={<InvoiceViewPage kind="purchase" />} />

          <Route path="/banking" element={<BankingPage />} />

          <Route path="/hrms/employees" element={<EmployeeListPage />} />
          <Route path="/hrms/employees/new" element={<AddEmployeePage />} />
          <Route path="/hrms/employees/:id" element={<EmployeeDashboardPage />} />
          <Route path="/hrms/payroll" element={<PayrollDashboardPage />} />
          <Route path="/hrms/payroll/computation" element={<PayrollComputationPage />} />
          <Route path="/hrms/payroll/salary-payment" element={<SalaryPaymentPage />} />
          <Route path="/hrms/attendance" element={<AttendancePage />} />
          <Route path="/hrms/tax-declaration" element={<TaxDeclarationPage />} />
          <Route path="/hrms/reports/:report" element={<PayrollReportsPage />} />
          <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
