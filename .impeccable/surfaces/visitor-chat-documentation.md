# Visitor chat: narrow documentation review

Reviewed 2026-10-04 against PRODUCT.md, incumbent DESIGN.md, visitor-chat.md, chat-panel.tsx, chat-moderation.tsx and the chat rules in globals.css. Evidence under .impeccable/review: chat-home-desktop.png and chat-home-iphone.png show arrival; recaptured chat-welcome-desktop.png and chat-welcome-iphone.png show onboarding after activation; chat-panel-desktop.png and chat-panel-iphone.png show the populated conversation.

The local extension retains Source Sans 3, incumbent paper/surface/ink/muted/line/accent/tint colors, flat white surfaces, fine dividers, tabular times, visible labels, controls of at least 44px, and restrained line icons. The welcome dialog, timeline, composer, reporting and moderation use that same vocabulary. The dialog backdrop is a local modal treatment; no new identity, global token or elevation rule is introduced.

The user revised activation: arrival preserves the results page and “Conversa” launcher, with no automatic registration dialog. Source review confirms that mount reads only local hidden-participant preferences; it makes no chat request. Clicking the launcher loads the session and opens the conversation, showing registration for an anonymous visitor or the timeline for a returning participant. Polling starts only while the panel is open. “Agora não” dismisses registration and permits reading without participating.

The updated surface brief records this explicit activation, optional city filter and textual dismissal at the top. Required locality selection, inline reports, connection feedback, public/self-declared identity copy and mobile stacking remain documented. Arrival captures support the unobstructed initial composition at desktop and iPhone sizes. Moderation styling was reviewed in source only. The implementing agent reported eight passing targeted E2E checks; this documentation pass did not rerun tests or independently certify every interaction or accessibility state.

DESIGN.md and .impeccable/design.json are preserved. The pre-existing stale sidecar warning remains unresolved: this task authorizes surface documentation only, not system regeneration or detector execution.

Documentation is complete for this narrow visual extension. Business behavior, infrastructure, security and deployment approval are outside this documentation review.
