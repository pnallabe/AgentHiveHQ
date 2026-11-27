"""Outreach email templates — the "Exam-Ready" 3-touch sequence.

Voice rules (per docs/PMF_ANALYSIS_AND_REBRANDING.md):
  * Plain text, founder-signed, <120 words per touch. No HTML slop.
  * Lead with the Audit Fabric wedge: "audit package in 5 minutes, not 6 weeks."
  * Counter-position against black-box model vendors: "you own the model."
  * One CTA per email. No links in touch 1 (deliverability).
  * Every email ends with a one-click unsubscribe footer (CAN-SPAM / Gmail
    one-click requirement) — the outreach is governed too.

Personalisation tokens (rendered by sequencer.render_template):
  {{first_name}} {{company}} {{title}} {{sender_name}} {{sender_email}}
  {{booking_url}} {{unsubscribe_url}} {{pixel_url}}
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    name: str
    subject: str
    body: str


# ── Sequence definition ───────────────────────────────────────────────────────
# delay_days is measured from the PREVIOUS touch.
EXAM_READY_SEQUENCE = {
    "name": "exam-ready-v1",
    "description": (
        "3-touch founder-led sequence for Heads of Model Risk / CROs at "
        "mid-market fintech lenders. Wedge: SR 11-7 audit-package automation."
    ),
    "steps": [
        {"step": 1, "delay_days": 0, "template": "exam_ready_t1"},
        {"step": 2, "delay_days": 4, "template": "exam_ready_t2"},
        {"step": 3, "delay_days": 9, "template": "exam_ready_t3"},
    ],
}

_FOOTER = """

--
{{sender_name}}, AgentHive
Audit-ready AI lending · agenthivehq.com

Don't want these emails? One click and you're out: {{unsubscribe_url}}"""


TEMPLATES: dict[str, Template] = {
    # ── Touch 1 (day 0) — pain-led, no links ────────────────────────────────
    "exam_ready_t1": Template(
        name="exam_ready_t1",
        subject="model risk exam prep at {{company}}",
        body="""Hi {{first_name}},

Quick question: when your team preps for a model risk exam, how long does assembling the SR 11-7 validation documentation take? For most mid-market lenders I talk to, it's a 6-week scramble across model code, decision logs, and fairness testing.

We built AgentHive to compress that to minutes — the platform generates the full audit package (validation report, reason codes, disparate-impact monitoring) from your live decisioning data.

Happy to send over a redacted sample audit package so you can judge it against your last exam. Worth a look?

{{sender_name}}""" + _FOOTER,
    ),
    # ── Touch 2 (day 4) — proof artifact + counter-position ─────────────────
    "exam_ready_t2": Template(
        name="exam_ready_t2",
        subject="re: model risk exam prep at {{company}}",
        body="""Hi {{first_name}},

Following up with the thing I promised — here's where to grab a sample audit package and run a live governance demo: {{booking_url}}

One thing that makes us different from the black-box model vendors: you own the model. AgentHive is the governance layer on top of your decisioning — explainability, bias monitoring, and exam artifacts — not another model you have to defend to examiners.

If exam readiness is on this year's roadmap, I'd value 15 minutes. If not, just reply "later" and I'll close the loop politely.

{{sender_name}}""" + _FOOTER,
    ),
    # ── Touch 3 (day 9) — breakup ───────────────────────────────────────────
    "exam_ready_t3": Template(
        name="exam_ready_t3",
        subject="closing the loop",
        body="""Hi {{first_name}},

Last note from me. I know model risk priorities compete with origination targets, and timing isn't always right.

Should I close the file — or is exam readiness something {{company}} is looking at later this year? A one-word reply ("later" works fine) helps me respect your inbox either way.

Thanks for the read,
{{sender_name}}""" + _FOOTER,
    ),
}


def render_template(template: Template, tokens: dict[str, str]) -> tuple[str, str]:
    """Render subject + body with personalisation tokens.

    Unknown tokens are left intact (visible in dry-run logs for QA) rather
    than silently blanked.
    """
    subject, body = template.subject, template.body
    for key, value in tokens.items():
        subject = subject.replace("{{" + key + "}}", value)
        body = body.replace("{{" + key + "}}", value)
    return subject, body
