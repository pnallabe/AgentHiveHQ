"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  KeyRound,
  Trash2,
  Copy,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_by: string | null;
  created_at: string | null;
  last_used_at: string | null;
  revoked: boolean;
}

interface CreateResponse {
  api_key: ApiKey;
  plaintext_key: string;
  notice: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const AVAILABLE_SCOPES = [
  { value: "decisions:write", label: "decisions:write" },
  { value: "decisions:read", label: "decisions:read" },
  { value: "governance:read", label: "governance:read" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ApiKeysPage() {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading, isUnlinked } = useTenant();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["decisions:write"]);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = tenant?.role === "admin";

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
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/api-keys`, {
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setKeys(data.api_keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (tenant && isAdmin) void load();
    else if (tenant) setLoading(false);
  }, [tenant, isAdmin, load]);

  const toggleScope = (s: string) =>
    setScopes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const create = async () => {
    if (!name.trim() || scopes.length === 0) return;
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/api-keys`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ name: name.trim(), scopes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${res.status}`);
      }
      const data: CreateResponse = await res.json();
      setNewKey(data);
      setName("");
      setScopes(["decisions:write"]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string, keyName: string) => {
    if (!window.confirm(`Revoke API key "${keyName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/tenants/me/api-keys/${id}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke failed");
    }
  };

  const copyKey = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey.plaintext_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
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
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070911] px-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
          <p className="text-gray-300">API keys are managed by tenant admins.</p>
          <Link href="/tenant-portal" className="text-[#73B9FF] hover:underline text-sm">
            ← Back to workspace
          </Link>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#070911] text-white py-10 px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            href="/tenant-portal"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" /> Tenant workspace
          </Link>
          <h1 className="text-2xl font-bold text-[#73B9FF] mt-2">API Keys</h1>
          <p className="text-sm text-gray-400 mt-1">
            Programmatic access for {tenant.display_name} ·{" "}
            <span className="font-mono">{tenant.slug}</span>
          </p>
        </div>

        {/* One-time new-key banner */}
        {newKey && (
          <div className="rounded-2xl border border-[#17E8BD]/40 bg-[#17E8BD]/10 p-5 space-y-3">
            <p className="text-sm font-semibold text-[#17E8BD] flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> {newKey.notice}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-[#070911] border border-gray-700 px-3 py-2 font-mono text-xs text-white break-all">
                {newKey.plaintext_key}
              </code>
              <Button
                onClick={copyKey}
                size="sm"
                className="bg-[#17E8BD] text-[#070911] hover:bg-[#4df0cd] shrink-0"
              >
                <Copy className="h-4 w-4 mr-1" /> {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Send it as the <code className="font-mono">X-AgentHive-Key</code> header.
            </p>
          </div>
        )}

        {/* Create form */}
        <div className="bg-[#111625] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#17E8BD]" /> Create an API key
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Key name (e.g. production LOS)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0d111c] border-gray-700 text-white flex-1"
            />
            <Button
              onClick={create}
              disabled={creating || !name.trim() || scopes.length === 0}
              className="bg-[#73B9FF] text-[#070911] hover:bg-[#9cc9ff]"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create key"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_SCOPES.map((s) => {
              const active = scopes.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleScope(s.value)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    active
                      ? "border-[#17E8BD]/50 bg-[#17E8BD]/15 text-[#17E8BD]"
                      : "border-gray-700 bg-transparent text-gray-500 hover:border-gray-500"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 ring-1 ring-red-500/30 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {/* Keys table */}
        <div className="bg-[#111625] border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#73B9FF]" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-center text-gray-500 py-16 text-sm">
              No API keys yet. Create one above to enable programmatic access.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Name</TableHead>
                  <TableHead className="text-gray-400">Key</TableHead>
                  <TableHead className="text-gray-400">Scopes</TableHead>
                  <TableHead className="text-gray-400">Last used</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-right text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id} className="border-gray-800">
                    <TableCell className="text-white font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-400">
                      {k.key_prefix}…
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {k.scopes.map((s) => (
                          <Badge
                            key={s}
                            className="bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40 font-mono text-[10px]"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      {k.revoked ? (
                        <Badge className="bg-red-500/15 text-red-300 ring-1 ring-red-500/40">
                          Revoked
                        </Badge>
                      ) : (
                        <Badge className="bg-[#17E8BD]/15 text-[#17E8BD] ring-1 ring-[#17E8BD]/40">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!k.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revoke(k.id, k.name)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
