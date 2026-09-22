import { HashRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { BharatConnectPlaceholder } from "./pages/settings/BharatConnectPlaceholder";
import { BharatConnectPage } from "./pages/settings/bharatconnect/BharatConnectPage";
import { ProfilePage } from "./pages/settings/bharatconnect/profile/ProfilePage";
import { IdsPage } from "./pages/settings/bharatconnect/IdsPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings/bharatconnect" element={<BharatConnectPage />} />
          <Route path="/settings/bharatconnect/profile/*" element={<ProfilePage />} />
          <Route path="/settings/bharatconnect/ids" element={<IdsPage />} />
          <Route
            path="/sales/counterparty-search"
            element={<BharatConnectPlaceholder label="Send via BharatConnect" />}
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}
