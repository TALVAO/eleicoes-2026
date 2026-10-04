# Visitor conversation

Mode: Operate. Local extension of the established election dashboard, code-led.

Job: identify a visitor by nickname and self-declared city/state, then exchange short public comments while following the count. On first visit, show the registration dialog; “Agora não” preserves immediate access to official results. Returning participants use their protected 24-hour session.

Direction: retain the dashboard’s flat editorial palette, Source Sans 3, restrained green, 44px controls and visible labels. The conversation opens below results, with a fixed compact launcher. Comments have their own disclaimer and never feed election models.

First viewport: a focused native onboarding dialog with nickname, official-catalog region and city selectors, an optional city filter revealed by “Filtrar cidades”, a clear primary submit and a textual “Agora não, ver resultados” dismissal at the top. The repeated dismissal below the form remains available after scrolling. City selection is required; filtering is optional. No fabricated electoral data.

Signature interaction: a participant’s short comment joins a chronological public timeline, retaining nickname and locality; a report expands inline with its reason. Updates only while the panel and browser tab are active.

States: new/returning visitor, loading, empty conversation, connected, offline last messages, session expired, blocked participant, cooldown, malformed text, report submitted, administration authenticated/denied.

Constraints: existing free PC/Redis/Vercel gateway; no new paid provider, no editorial redesign. Text-only, maximum 280 characters, no links or HTML. Moderation is manual; location and nickname are self-declared, not verified identities. No approved comp or new visual-world seed applies to this local extension.

Verification: desktop 1440 and iPhone 13 Chromium; welcome dialog and populated panel, AA accessibility, two participant sessions, persistence on reload, reporting/removal, API origin/session/admin restrictions, real Redis atomic concurrency tests.
