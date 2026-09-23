import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { useStore } from "../../store/useStore";
import { BharatConnectMark } from "../../components/layout/BharatConnectMark";
import { COUNTERPARTY_DIRECTORY } from "../../mock/seed";
import { configFor, money } from "./kindConfig";
import type { Invoice } from "../../types";

const TERMS =
  "Payment is due within 30 days from the invoice date. Interest may apply on overdue amounts. All taxes are charged as applicable. Goods/services remain the property of the seller until full payment is received. Discrepancies must be reported within 7 days. Goods once sold are not returnable. All disputes are subject to your jurisdiction.";

export function InvoiceCreatePage({ kind }: { kind: "sales" | "purchase" }) {
  const config = configFor(kind);
  const navigate = useNavigate();
  const business = useStore((s) => s.currentBusiness());
  const createInvoice = useStore((s) => s.createInvoice);
  const connected = business.connectionState === "connected";

  const [query, setQuery] = useState("");
  const [counterparty, setCounterparty] = useState<{ name: string; bcId: string | null } | null>(null);
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [gstPercent, setGstPercent] = useState("18");
  const [hsnSac, setHsnSac] = useState("");
  const [sendViaBc, setSendViaBc] = useState(false);
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return COUNTERPARTY_DIRECTORY.filter((c) => c.registeredName.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  }, [query]);

  function selectCounterparty(name: string, bcId: string | null) {
    setCounterparty({ name, bcId });
    setQuery(name);
    setSendViaBc(kind === "sales" && connected && !!bcId);
  }

  const priceNum = parseFloat(price) || 0;
  const qtyNum = parseFloat(qty) || 0;
  const gstNum = parseFloat(gstPercent) || 0;
  const subtotal = priceNum * qtyNum;
  const gstAmount = subtotal * (gstNum / 100);
  const total = subtotal + gstAmount;

  async function handleCreate() {
    if (!counterparty || !itemName) return;
    setSaving(true);
    const invoice: Invoice = {
      id: `${kind === "sales" ? "LP" : "BILL"}-${Math.floor(Math.random() * 90000 + 10000)}`,
      kind,
      counterpartyName: counterparty.name,
      counterpartyB2bId: counterparty.bcId,
      amount: total,
      status: "unpaid",
      date: new Date().toLocaleDateString("en-GB").split("/").join("-"),
      lineItems: [{ id: "li-1", name: itemName, price: priceNum, qty: qtyNum, gstPercent: gstNum, hsnSac }],
      bcSendStatus: sendViaBc ? "sending" : "not_sent",
      bcConfirmationStatus: null,
    };
    await createInvoice(invoice);
    setSaving(false);
    if (sendViaBc) {
      navigate(`${config.basePath}/${invoice.id}`);
      useStore.getState().sendInvoiceViaBharatConnect(invoice.id);
    } else {
      navigate(config.basePath);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-ink">Create {config.singular}</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-ink">
              {business.name}
              <Pencil className="h-3 w-3 text-faint" />
            </div>
            <div className="text-sm text-faint">
              {business.registeredAddress.city}, {business.registeredAddress.state}
            </div>
            <div className="text-sm text-faint">GSTIN: {business.gstin}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-faint">Date:</span>
            <span className="text-ink">{new Date().toLocaleDateString("en-GB")}</span>
            <span className="text-faint">Due Date:</span>
            <span className="text-ink">—</span>
          </div>
        </div>

        <div className="relative border-b border-gray-100 py-5">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCounterparty(null);
            }}
            placeholder={`Search ${kind === "sales" ? "customer" : "supplier"}...`}
            className="w-80 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {matches.length > 0 && !counterparty && (
            <div className="absolute z-10 mt-1 w-96 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg">
              {matches.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectCounterparty(m.registeredName, m.legacyFormat ? null : m.bcId)}
                  className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="text-ink">{m.registeredName}</span>
                  {!m.legacyFormat && <span className="font-mono text-xs text-faint">{m.bcId}</span>}
                </button>
              ))}
            </div>
          )}
          {counterparty?.bcId && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-faint">
              <BharatConnectMark size={12} />
              <span className="font-mono">{counterparty.bcId}</span>
            </div>
          )}
        </div>

        <div className="border-b border-gray-100 py-5">
          <div className="mb-2 grid grid-cols-[1fr_120px_80px_100px_120px_100px] gap-3 text-xs font-medium uppercase tracking-wide text-faint">
            <span>Item</span>
            <span>Price</span>
            <span>Qty</span>
            <span>GST</span>
            <span>HSN/SAC</span>
            <span className="text-right">Total</span>
          </div>
          <div className="grid grid-cols-[1fr_120px_80px_100px_120px_100px] items-center gap-3">
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Item name"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {[0, 5, 12, 18, 28].map((g) => (
                <option key={g} value={g}>
                  {g}%
                </option>
              ))}
            </select>
            <input
              value={hsnSac}
              onChange={(e) => setHsnSac(e.target.value)}
              placeholder="Item code"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="text-right font-medium text-ink">INR {money(total)}</span>
          </div>
        </div>

        {connected && kind === "sales" && (
          <div className="border-b border-gray-100 py-5">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={sendViaBc}
                onChange={(e) => setSendViaBc(e.target.checked)}
                disabled={!counterparty?.bcId}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-40"
              />
              <span className="text-body">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <BharatConnectMark size={13} />
                  Send via BharatConnect
                </span>
                {counterparty?.bcId ? (
                  <span className="text-faint">Delivered straight to their BharatConnect ID — no email attachment.</span>
                ) : (
                  <span className="text-faint">Search and select a customer with a BharatConnect ID to enable this.</span>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 py-5">
          <textarea
            defaultValue={TERMS}
            rows={5}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-faint">Subtotal</span>
              <span className="text-ink">INR {money(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">GST</span>
              <span className="text-ink">INR {money(gstAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold">
              <span className="text-ink">Total</span>
              <span className="text-ink">INR {money(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleCreate}
            disabled={!counterparty || !itemName || saving}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {saving ? "Creating…" : config.createLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
