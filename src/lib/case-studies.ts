// ---------------------------------------------------------------------------
// Case Studies — static data
// ---------------------------------------------------------------------------

export interface CaseStudyTable {
  cols: string[];
  rows: string[][];
}

export interface CaseStudySection {
  heading: string;
  body: string;
  table?: CaseStudyTable;
  blockquote?: string;
}

export interface CaseStudy {
  slug: string;
  /** Short card badge (e.g. "Thin-File Lending") */
  category: string;
  title: string;
  summary: string;
  /** A single headline metric */
  stat: string;
  statLabel: string;
  /** Tailwind color class for the stat text */
  statColor: string;
  /** Tailwind color class for the category badge */
  badgeColor: string;
  sections: CaseStudySection[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "thin-file-underwriting",
    category: "Thin-File Lending",
    title: "18% lift in approval rate for credit-invisible applicants",
    summary:
      "A regional CDFI used Helix Decisions to expand credit access to consumers with fewer than 3 trade-lines — without relaxing risk thresholds.",
    stat: "+18%",
    statLabel: "approval-rate lift",
    statColor: "text-approve-base",
    badgeColor: "bg-approve-muted text-approve-base",
    sections: [
      {
        heading: "Context",
        body:
          "A mission-driven CDFI serving 400,000+ members lacked the data depth to make confident decisions on credit-invisible applicants. Traditional bureau scores returned either no-hit or shallow files for nearly 30% of their pipeline.",
      },
      {
        heading: "What we built",
        body:
          "Helix Decisions's underwriting module was configured with an alternate-data feature set: cash-flow volatility from bank-feed data, rent-payment history (via Plaid), and utility trade-lines. The SHAP explainability layer surfaced which signals drove each decision — satisfying FCRA adverse-action disclosure requirements automatically.",
      },
      {
        heading: "Results",
        body: "",
        table: {
          cols: ["Metric", "Before", "After"],
          rows: [
            ["Approval rate (thin-file)", "41%", "59%"],
            ["Average time-to-decision", "3.1 days", "12 seconds"],
            ["Model-governance findings", "—", "0"],
            ["Default rate (6-month)", "4.2%", "4.0%"],
          ],
        },
        blockquote:
          "\"For the first time, we could approve a qualified applicant without a bureau score and hand them a printed adverse-action notice instantly — all compliant, all explainable.\" — Chief Credit Officer",
      },
    ],
  },
  {
    slug: "gig-economy-credit",
    category: "Gig Economy",
    title: "31% reduction in income-uncertainty defaults for gig workers",
    summary:
      "An online lender serving independent contractors replaced static income underwriting with a cash-flow volatility model — cutting defaults without shrinking the book.",
    stat: "−31%",
    statLabel: "default rate reduction",
    statColor: "text-approve-base",
    badgeColor: "bg-brand-950 text-brand-300",
    sections: [
      {
        heading: "Context",
        body:
          "A fintech lender discovered that gig-economy borrowers had 2.4× the default rate of traditional W-2 borrowers at equivalent stated DTI ratios. Volatility in monthly income — not income level — was the root cause.",
      },
      {
        heading: "What we built",
        body:
          "Helix Decisions's feature engineering pipeline constructed a 12-month rolling income-volatility index from bank-feed transactions. The rules engine added an income-stability gate on top of the ML score, with automatic SHAP reason codes for every decline.",
      },
      {
        heading: "Results",
        body: "",
        table: {
          cols: ["Metric", "Before", "After"],
          rows: [
            ["12-month default (gig cohort)", "8.9%", "6.1%"],
            ["Approval rate (gig cohort)", "54%", "57%"],
            ["Manual-review queue depth", "38% of pipeline", "7% of pipeline"],
            ["Regulatory exam findings", "2", "0"],
          ],
        },
        blockquote:
          "\"We didn't shrink our book — we just stopped lending to volatility risk we couldn't see. Helix Decisions made that volatility visible.\" — Head of Risk",
      },
    ],
  },
  {
    slug: "model-governance",
    category: "Model Governance",
    title: "Zero exam findings across two federal regulatory reviews",
    summary:
      "A mid-size bank used Helix Decisions's governance dashboard to achieve clean SR 11-7 compliance during consecutive OCC and Federal Reserve model-risk examinations.",
    stat: "0",
    statLabel: "exam findings",
    statColor: "text-brand-300",
    badgeColor: "bg-zinc-800 text-zinc-400",
    sections: [
      {
        heading: "Context",
        body:
          "A $4B-asset bank had received MRA (matter requiring attention) citations in three consecutive regulatory exams for insufficient model documentation and lack of ongoing performance monitoring.",
      },
      {
        heading: "What we built",
        body:
          "Helix Decisions's governance module provided real-time approval-rate monitoring by demographic segment with adverse-impact-ratio alerts, immutable hash-chained audit logs (ISO 8601) exportable as signed JSON for examiner review, and automated SR 11-7 documentation — model card, feature inventory, and ongoing monitoring schedule — generated from the live system.",
      },
      {
        heading: "Results",
        body: "",
        table: {
          cols: ["Metric", "Before", "After"],
          rows: [
            ["MRA / MRIA findings", "3 per exam", "0"],
            ["Time to produce model documentation", "6 weeks", "Real-time"],
            ["Exam preparation staff-hours", "480 hrs", "18 hrs"],
            ["Days between monitoring reports", "90", "1"],
          ],
        },
        blockquote:
          "\"The examiners noted they had never seen a credit model with this level of live monitoring and documentation. It changed the entire tone of the review.\" — Chief Risk Officer",
      },
    ],
  },
];

/** Utility: get a single case study by slug, or null if not found. */
export function getCaseStudy(slug: string): CaseStudy | null {
  return CASE_STUDIES.find((cs) => cs.slug === slug) ?? null;
}

