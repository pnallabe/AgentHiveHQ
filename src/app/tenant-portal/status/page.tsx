"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient, type AuditRecord } from "@/lib/tenant/api-client";

type StatusStage = "submitted" | "processing" | "decided";

interface TimelineEvent {
  label: string;
  description: string;
  stage: StatusStage;
  completed: boolean;
  timestamp?: string;
}

export default function StatusPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#070911]">
          <div className="text-center text-gray-500 font-space-grotesk">
            <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-[#73B9FF]" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
            </svg>
            Loading status…
          </div>
        </div>
      }
    >
      <StatusContent />
    </Suspense>
  );
}

function StatusContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("id") ?? "";

  const [auditRecord, setAuditRecord] = useState<AuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const fetchStatus = useCallback(async () => {
    if (!applicationId) {
      setIsLoading(false);
      return;
    }

    const result = await apiClient.getAuditRecord(applicationId);
    setLastChecked(new Date());

    if (!result.ok) {
      if (result.error.status === 404) {
        setError(null); // Not yet available — still processing
      } else {
        setError(`Could not fetch status: ${result.error.message}`);
      }
      setIsLoading(false);
      return;
    }

    setAuditRecord(result.data);
    setIsLoading(false);
    setError(null);
  }, [applicationId]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 5 seconds if no decision yet
  useEffect(() => {
    if (auditRecord?.decision_output) return; // Resolved — stop polling
    if (!applicationId) return;

    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [auditRecord, fetchStatus, applicationId]);

  const decisionOutput = auditRecord?.decision_output?.toUpperCase();

  const timelineEvents: TimelineEvent[] = [
    {
      label: "Submitted",
      description: "Your application was received by our systems.",
      stage: "submitted",
      completed: true,
      timestamp: auditRecord?.logged_at
        ? new Date(auditRecord.logged_at).toLocaleString()
        : undefined,
    },
    {
      label: "Under Review",
      description: "Our AI is analyzing your application and running credit checks.",
      stage: "processing",
      completed: !!auditRecord,
    },
    {
      label: "Decision Made",
      description: auditRecord?.decision_output
        ? `Decision: ${decisionOutput}`
        : "Awaiting decision from our underwriting engine.",
      stage: "decided",
      completed: !!auditRecord?.decision_output,
    },
  ];

  return (
    <div className="min-h-screen bg-[#070911] py-12 px-4 font-space-grotesk">
      <div className="container mx-auto max-w-xl">
        <div className="bg-[#111625] rounded-2xl border border-gray-800 shadow-sm p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Application Status</h1>
            <p className="text-sm text-gray-400 mt-1">
              ID:{" "}
              <span className="font-mono text-gray-500 break-all">{applicationId || "None provided"}</span>
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {timelineEvents.map((event, index) => (
              <div key={event.stage} className="flex gap-4 pb-8 last:pb-0">
                {/* Connector line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                      event.completed
                        ? "bg-[#73B9FF] border-[#73B9FF] text-[#070911]"
                        : index === timelineEvents.findIndex((e) => !e.completed)
                        ? "bg-[#0d111c] border-[#73B9FF] text-[#73B9FF] animate-pulse"
                        : "bg-[#0d111c] border-gray-800 text-gray-700"
                    }`}
                  >
                    {event.completed ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : index === timelineEvents.findIndex((e) => !e.completed) ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                      </svg>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
                    )}
                  </div>
                  {index < timelineEvents.length - 1 && (
                    <div
                      className={`w-0.5 flex-1 mt-1 ${
                        event.completed ? "bg-[#73B9FF]/30" : "bg-gray-800"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-1.5 pb-2">
                  <div className="flex items-center justify-between">
                    <h3
                      className={`font-semibold ${
                        event.completed ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {event.label}
                    </h3>
                    {event.timestamp && (
                      <span className="text-xs text-gray-500">{event.timestamp}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{event.description}</p>

                  {/* Decision badge */}
                  {event.stage === "decided" && auditRecord?.decision_output && (
                    <div className="mt-3">
                      <DecisionBadge decision={decisionOutput ?? ""} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Audit details */}
          {auditRecord && (
            <div className="mt-6 border-t border-gray-800 pt-6">
              <h3 className="font-bold text-white mb-3">Decision Details</h3>
              <div className="space-y-2 text-sm bg-[#0d111c] p-4 rounded-xl border border-gray-800">
                <AuditRow label="Risk Score" value={(auditRecord.risk_score * 100).toFixed(1) + "%"} />
                <AuditRow label="Fraud Score" value={(auditRecord.fraud_score * 100).toFixed(1) + "%"} />
                <AuditRow label="Model Version" value={auditRecord.model_version} />
                <AuditRow label="Feature Version" value={auditRecord.feature_version} />
                <AuditRow label="Decision Latency" value={`${auditRecord.decision_latency_ms}ms`} />
                {auditRecord.reason_codes?.length > 0 && (
                  <AuditRow label="Reason Codes" value={auditRecord.reason_codes.join(", ")} />
                )}
              </div>
            </div>
          )}

          {/* Loading / error state */}
          {isLoading && !applicationId && (
            <div className="text-amber-400 text-sm mt-4">
              Please provide an application ID in the URL (?id=...)
            </div>
          )}
          
          {isLoading && applicationId && (
            <div className="flex items-center gap-2 text-[#73B9FF] text-sm mt-4">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
              Loading status…
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-lg px-4 py-3 text-sm mt-4">
              {error}
            </div>
          )}

          {/* Last checked */}
          {applicationId && (
            <div className="text-xs text-gray-600 text-right mt-4">
              Last checked: {lastChecked.toLocaleTimeString()} · Auto-refreshes every 5s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "APPROVE") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-[#17E8BD]/10 border border-[#17E8BD]/20 text-[#17E8BD] font-semibold px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 rounded-full bg-[#17E8BD]" />
        Approved
      </span>
    );
  }
  if (decision === "REJECT") {
    return (
      <span className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-semibold px-3 py-1 rounded-full text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Declined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold px-3 py-1 rounded-full text-sm">
      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
      Under Review
    </span>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
