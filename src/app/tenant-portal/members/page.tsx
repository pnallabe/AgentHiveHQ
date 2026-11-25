"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  Trash2,
  ShieldCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types — mirror backend payloads
// ---------------------------------------------------------------------------

type Role = "admin" | "risk_manager" | "underwriter" | "auditor";
const ROLES: Role[] = ["admin", "risk_manager", "underwriter", "auditor"];

interface Member {
  id: string;
  user_uid: string;
  email: string | null;
  role: Role;
  created_at: string | null;
}

interface MembersResponse {
  tenant_slug: string;
  members: Member[];
  caller_role: Role;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-brand-500/15 text-brand-300 ring-brand-500/40",
  risk_manager: "bg-violet-500/15 text-violet-300 ring-violet-500/40",
  underwriter: "bg-sky-500/15 text-sky-300 ring-sky-500/40",
  auditor: "bg-zinc-500/15 text-zinc-300 ring-zinc-500/40",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MembersPage() {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, isUnlinked } = useTenant();

  const [members, setMembers] = useState<Member[]>([]);
  const [callerRole, setCallerRole] = useState<Role>("underwriter");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("underwriter");
  const [inviting, setInviting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isAdmin = callerRole === "admin";

  const authHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/members`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MembersResponse = await res.json();
      setMembers(data.members);
      setCallerRole(data.caller_role);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (tenant) void load();
  }, [tenant, load]);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/members`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      setNotice(`Invited ${inviteEmail.trim()} as ${inviteRole.replace("_", " ")}.`);
      setInviteEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (memberId: string, role: Role) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/members/${memberId}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role change failed");
    }
  };

  const revoke = async (memberId: string, email: string | null) => {
    if (!window.confirm(`Revoke access for ${email ?? memberId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/members/${memberId}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    }
  };

  // ── Guards ───────────────────────────────────────────────────────────────
  if (tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070911]">
        <Loader2 className="h-10 w-10 animate-spin text-[#73B9FF]" />
      </div>
    );
  }
  if (isUnlinked || !tenant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070911] px-6">
        <div className="text-center space-y-3">
          <ShieldCheck className="mx-auto h-10 w-10 text-amber-400" />
          <p className="text-gray-300">No tenant linked to your account.</p>
          <Link href="/signup" className="text-[#73B9FF] hover:underline text-sm">
            Request access →
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070911] text-white py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/tenant-portal"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" /> Tenant workspace
            </Link>
            <h1 className="text-2xl font-bold text-[#73B9FF] mt-2">Members &amp; Access</h1>
            <p className="text-sm text-gray-400 mt-1">
              {tenant.display_name} · <span className="font-mono">{tenant.slug}</span>
            </p>
          </div>
          <Badge className={`ring-1 capitalize ${ROLE_COLORS[tenant.role]}`}>
            You: {tenant.role.replace("_", " ")}
          </Badge>
        </div>

        {/* Invite (admin only) */}
        {isAdmin && (
          <div className="bg-[#111625] border border-gray-800 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4 text-[#17E8BD]" /> Invite a member
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="email"
                placeholder="teammate@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-[#0d111c] border-gray-700 text-white flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger className="bg-[#0d111c] border-gray-700 text-white sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">
                      {r.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={invite}
                disabled={inviting || !inviteEmail.trim()}
                className="bg-[#73B9FF] text-[#070911] hover:bg-[#9cc9ff]"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
              </Button>
            </div>
          </div>
        )}

        {notice && (
          <p className="text-sm text-[#17E8BD] bg-[#17E8BD]/10 ring-1 ring-[#17E8BD]/30 rounded-lg px-4 py-2">
            {notice}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Members table */}
        <div className="bg-[#111625] border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#73B9FF]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Member</TableHead>
                  <TableHead className="text-gray-400">Role</TableHead>
                  <TableHead className="text-gray-400">Added</TableHead>
                  {isAdmin && <TableHead className="text-right text-gray-400">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className="border-gray-800">
                    <TableCell className="text-white font-medium">
                      {m.email ?? m.user_uid}
                    </TableCell>
                    <TableCell>
                      {isAdmin && m.user_uid !== tenant.slug ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRole(m.id, v as Role)}
                        >
                          <SelectTrigger className="bg-[#0d111c] border-gray-700 text-white h-8 w-40 capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="capitalize">
                                {r.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`ring-1 capitalize ${ROLE_COLORS[m.role]}`}>
                          {m.role.replace("_", " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revoke(m.id, m.email)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!isAdmin && (
          <p className="text-xs text-gray-500">
            You have read-only access to the member list. Contact a tenant admin to make changes.
          </p>
        )}
      </div>
    </div>
  );
}
