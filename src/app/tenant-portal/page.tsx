"use client";

import { useTenant } from "@/contexts/TenantContext";
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";

export default function TenantDashboard() {
  const { tenant, setTenant } = useTenant();

  // Mock data to simulate the python backend data pulls
  const [data, setData] = useState({
    totalApps: 0,
    totalVolume: 0,
    avgScore: 0,
    avgDTI: 0,
    distribution: [] as { range: string; count: number }[],
    pricing: [] as { grade: string; m36: number; m60: number }[],
  });

  useEffect(() => {
    // Generate synthetic data based on tenant to mirror Streamlit behavior
    const isLC = tenant === "lending_club";
    const n = isLC ? 5000 : 1000;
    
    // Using deterministic random-ish numbers based on tenant
    setData({
      totalApps: n,
      totalVolume: isLC ? 45000000 : 8500000,
      avgScore: isLC ? 680 : 710,
      avgDTI: isLC ? 28.4 : 22.1,
      distribution: [
        { range: "500-600", count: isLC ? 400 : 50 },
        { range: "600-650", count: isLC ? 1200 : 200 },
        { range: "650-700", count: isLC ? 2000 : 400 },
        { range: "700-750", count: isLC ? 1000 : 250 },
        { range: "750+", count: isLC ? 400 : 100 },
      ],
      pricing: [
        { grade: "A", m36: 5.4, m60: 6.2 },
        { grade: "B", m36: 8.9, m60: 9.8 },
        { grade: "C", m36: 12.5, m60: 14.1 },
        { grade: "D", m36: 17.2, m60: 19.5 },
        { grade: "E", m36: 22.4, m60: 25.1 },
      ],
    });
  }, [tenant]);

  return (
    <div className="min-h-screen bg-[#070911] text-white py-10 px-6 font-space-grotesk">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#73B9FF]">🏦 Multi-Tenant Credit Risk Platform</h1>
            <p className="text-gray-400 mt-2">Monitor isolated tenant data, risk metrics, and dynamically generated pricing.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-[#111625] px-4 py-2 rounded-xl border border-gray-800">
            <span className="text-sm text-gray-400">Context:</span>
            <select 
              value={tenant}
              onChange={(e) => setTenant(e.target.value as any)}
              className="bg-transparent border-none text-white focus:ring-0 outline-none cursor-pointer"
            >
              <option value="lending_club" className="bg-[#111625]">Lending Club</option>
              <option value="synthetic_tenant_a" className="bg-[#111625]">Synthetic Tenant A</option>
              <option value="synthetic_tenant_b" className="bg-[#111625]">Synthetic Tenant B</option>
            </select>
          </div>
        </header>

        <section>
          <h2 className="text-xl font-semibold mb-4">Quick Links & Dashboards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <LinkCard 
              title="Applicant Portal" 
              description="Start a new loan application flow"
              href="/tenant-portal/apply" 
              icon="📝" 
            />
            <LinkCard 
              title="Analytics Dashboards" 
              description="View portfolio and risk analytics"
              href="/analytics/overview" 
              icon="📊" 
            />
            <LinkCard 
              title="Governance Suite" 
              description="Monitor AI decisions and bias"
              href="/lab/governance" 
              icon="⚖️" 
            />
            <LinkCard 
              title="AI Copilot" 
              description="Assist underwriters with AI"
              href="/lab/copilot" 
              icon="🤖" 
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Portfolio Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard label="Total Applications" value={data.totalApps.toLocaleString()} />
            <MetricCard label="Total Requested Volume" value={`$${data.totalVolume.toLocaleString()}`} />
            <MetricCard label="Avg Credit Score" value={data.avgScore.toString()} />
            <MetricCard label="Avg DTI" value={`${data.avgDTI}%`} />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#111625] p-6 rounded-2xl border border-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-[#73B9FF]">Credit Score Distribution</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="range" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111625', borderColor: '#374151', color: '#fff' }}
                    itemStyle={{ color: '#17E8BD' }}
                  />
                  <Bar dataKey="count" fill="#17E8BD" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#111625] p-6 rounded-2xl border border-gray-800">
            <h2 className="text-lg font-semibold mb-1 text-[#73B9FF]">Risk-Based Pricing Matrix</h2>
            <p className="text-xs text-gray-400 mb-6">Powered by the NPV Pricing Optimizer dynamically pulling WACC, OpEx, and EL targets.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-[#0d111c]">
                  <tr>
                    <th className="px-6 py-3 rounded-tl-lg">Grade</th>
                    <th className="px-6 py-3">36 Months</th>
                    <th className="px-6 py-3 rounded-tr-lg">60 Months</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pricing.map((row) => (
                    <tr key={row.grade} className="border-b border-gray-800 hover:bg-[#1a2133] transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{row.grade}</td>
                      <td className="px-6 py-4 text-[#17E8BD]">{row.m36.toFixed(2)}%</td>
                      <td className="px-6 py-4 text-[#17E8BD]">{row.m60.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111625] p-6 rounded-2xl border border-gray-800">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold text-white mt-2">{value}</p>
    </div>
  );
}

function LinkCard({ title, description, href, icon }: { title: string; description: string; href: string; icon: string }) {
  return (
    <Link 
      href={href} 
      className="bg-[#111625] p-6 rounded-2xl border border-gray-800 hover:border-[#73B9FF] transition-all group flex flex-col justify-between"
    >
      <div>
        <div className="text-2xl mb-3">{icon}</div>
        <h3 className="text-lg font-bold text-white group-hover:text-[#73B9FF] transition-colors">{title}</h3>
        <p className="text-sm text-gray-400 mt-2">{description}</p>
      </div>
      <div className="mt-4 text-[#17E8BD] text-sm font-semibold flex items-center gap-1">
        Open <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
    </Link>
  );
}
