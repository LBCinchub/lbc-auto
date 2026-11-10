import React from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const GROUPS = [
  ["view", "View & Edit"],
  ["send", "Send, Print & Signature"],
  ["money", "Payments & Conversions"],
  ["danger", "Danger Zone"],
];

// A few labeled primary actions plus an accessible "More Actions" menu.
// action: { id, label, icon, onClick, group, primary, badge, tone, disabled }
export default function DocumentActionBar({ actions, busyId }) {
  const list = actions.filter(Boolean);
  const primary = list.filter((a) => a.primary);
  const locked = !!busyId;
  const run = (a) => (e) => { e?.stopPropagation?.(); if (!locked && !a.disabled) a.onClick(); };

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {primary.map((a) => {
        const Icon = busyId === a.id ? Loader2 : a.icon;
        return (
          <Button key={a.id} type="button" size="sm" variant="outline" disabled={locked || a.disabled} onClick={run(a)}
            className={`min-h-[44px] sm:min-h-9 gap-1.5 border-gray-700 bg-gray-900 text-xs font-semibold hover:bg-gray-800 ${a.tone || "text-gray-200"}`}>
            {Icon && <Icon className={`h-3.5 w-3.5 ${busyId === a.id ? "animate-spin" : ""}`} />}{a.label}{a.badge}
          </Button>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="ghost" disabled={locked} aria-label="More Actions"
            className="min-h-[44px] sm:min-h-9 gap-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-white">
            <MoreHorizontal className="h-4 w-4" /> More Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 border-gray-800 bg-gray-900 text-gray-200" onClick={(e) => e.stopPropagation()}>
          {GROUPS.map(([key, title], gi) => {
            const items = list.filter((a) => a.group === key);
            if (!items.length) return null;
            return (
              <React.Fragment key={key}>
                {gi > 0 && <DropdownMenuSeparator className="bg-gray-800" />}
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-gray-500">{title}</DropdownMenuLabel>
                {items.map((a) => {
                  const Icon = a.icon;
                  return (
                    <DropdownMenuItem key={a.id} disabled={a.disabled} onSelect={() => run(a)()}
                      className={`min-h-[40px] gap-2 cursor-pointer ${key === "danger" ? "text-rose-400 focus:text-rose-300" : ""}`}>
                      {Icon && <Icon className="h-4 w-4" />}{a.label}{a.badge}
                    </DropdownMenuItem>
                  );
                })}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}