import { Plug } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";
import { tableCls, tdCls, thCls, trCls } from "../../components/ui/table";
import { cn } from "../../lib/cn";
import { useBankingStore } from "../../store/useBankingStore";
import { BankIcon } from "./BankLogo";
import { PAY_FROM_BANKS, fmtINR, type BankKey } from "./data";

/** The company's current accounts and whether Connected Banking is set up on each. */
export function AccountsTab({ onConnect }: { onConnect: (bank: BankKey) => void }) {
  const scenario = useBankingStore((s) => s.scenario);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Bank accounts</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className={tableCls}>
          <thead>
            <tr>
              <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Bank</th>
              <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Account</th>
              <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Connected Banking</th>
              <th className={cn(thCls, "bg-muted font-medium text-foreground")}>Payment approval</th>
              <th className={cn(thCls, "bg-muted text-right font-medium text-foreground")}>Balance</th>
              <th className={cn(thCls, "w-44 bg-muted")} />
            </tr>
          </thead>
          <tbody>
            {PAY_FROM_BANKS.map((b) => {
              const connected = scenario.connected[b.key];
              const approval = b.key === "icici" ? "single" : scenario.approval[b.key];
              return (
                <tr key={b.key} className={trCls}>
                  <td className={tdCls}>
                    <span className="flex items-center gap-3">
                      <BankIcon bank={b.key} size={32} />
                      <span className="font-medium">{b.bank}</span>
                    </span>
                  </td>
                  <td className={cn(tdCls, "tabular-nums")}>
                    Current {b.masked}
                  </td>
                  <td className={tdCls}>
                    {connected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Not connected</Badge>}
                  </td>
                  <td className={cn(tdCls, "text-muted-foreground")}>
                    {connected ? (approval === "maker-checker" ? "Maker & checker" : "One user") : "—"}
                  </td>
                  <td className={cn(tdCls, "text-right tabular-nums")}>
                    {connected ? fmtINR(b.balances[scenario.balance === "low" ? 1 : 0]) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className={cn(tdCls, "text-right")}>
                    {!connected && (
                      <Button size="sm" onClick={() => onConnect(b.key)}>
                        <Plug />
                        Connect banking
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
