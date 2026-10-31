# Interface system

User-directed HUMAIN palette: near-black #050c10, deep teal #006c7d, turquoise #00c9aa, electric lime #caff3d, cool white #f5f7f8 and pale gray cards. The supplied transparent HUMAIN PNG is reused unchanged, with a CSS white treatment on dark surfaces. Original layered glass artwork echoes the teal/lime references. Platform name is HUMAIN Lifecycle; assistant name is HUMAIN Chat. The canonical assistant route is /chat; /wasl redirects with query parameters preserved. This remains an independent hackathon application.

Segoe UI/Inter/system sans typography, restrained letter spacing, roomy cards, semantic status badges, consistent Lucide icons, table rows, profile avatars and capped content widths. The sidebar groups eight workspace views, a distinct AI ASSISTANT/HUMAIN Chat section and administration. It scrolls on shorter windows and becomes a dismissible drawer on mobile. Main content is keyboard reachable; focus-visible rings are present. Dialogs use Radix focus containment and escape dismissal. Loading skeletons, empty states, explicit server failures and Sonner execution feedback are shared components.

HUMAIN Chat has a central conversation, durable history selector, suggested prompts, attachments, model status and a desktop execution context panel. Narrow layouts prioritize the chat and composer. Arabic messages use dir=auto; Enter sends and Shift+Enter inserts a newline. Markdown is rendered without raw HTML execution. Copy uses the browser clipboard API. Transport failures keep partial output and a visible error; an explicit retry gets a new request identity, and tool idempotency protects completed actions.

Charts show actual workforce categories, never fabricated historical growth. Dashboard and directory data come from API queries. Every visible button either navigates, performs a real API operation, opens a working dialog, or is disabled with an explanation. Integration cards identify unavailable real provisioning. Configuration is visibly read-only through the UI and points to local environment setup.

Screenshots are generated during Playwright verification. They show synthetic test workspace records; test and development counts can differ. Basic verification covers labels, dialogs, responsive overflow, sidebar navigation, message direction and visible error states. A full WCAG audit and screen-reader pass have not been completed.

## Floating surface refinement

Shared elevation tokens live in frontend/src/depth.css. The application canvas and dark HUMAIN sidebar float above a cool neutral gradient with rounded outside corners. Cards share soft directional shadows, fine borders and inset highlights. Integration icons, approved buttons and the model orb use restrained gradients for depth. Inputs, tables, dialogs, charts, workflow cards and Chat apply the same material hierarchy. Responsive gutters and chat viewport heights keep the mobile composer reachable. Hover motion is limited to interactive controls and respects reduced-motion preferences. Navigation, page grids, API operations and business logic are retained.

## Corner and Lifecycle lettering refinement

Shared corner radii were reduced by roughly one third while retaining elevation and surface gradients. Shell corners are 16 px, cards 12 px, and buttons 10 px, with tighter responsive values. The sidebar LIFECYCLE descriptor is an accessible green (#caff3d) geometric vector wordmark following the supplied logo’s wide lettering and even strokes. The supplied PNG does not include an installable brand font; the original HUMAIN logo asset remains unchanged.

## Edge-to-edge application shell

The app now fills the browser viewport. The desktop sidebar starts at the top-left with no outer inset; the main shell directly adjoins it and extends to the right and bottom edges. The centered 1720 px page cap is removed so large displays can use the available width. Mobile main content spans the full viewport; Chat height accounts only for its header. Card spacing, elevation, tighter interior radii, dark sidebar and green Lifecycle lettering remain.

## Email settings form

Settings now includes a styled two-column Email settings panel with delivery mode, alert window, SMTP host/port, sender, username, write-only password, alert recipient and approved recipients. The password visibility toggle reveals newly entered text only; an existing secret is represented by a saved-state badge. Inline validation explains policy failures. Save feedback states that no mail was sent. Narrow layouts stack the same fields. Real mode presents an explicit delivery authorization checkbox.


## Familiar chat navigation

HUMAIN Chat uses a collapsible left conversation sidebar with New chat, local history search, date groups, current-chat highlighting and conversation deep links. Below 1000 px it becomes an overlay drawer that closes when a chat is selected. Enterprise navigation remains available. The right agent-context panel and welcome processing/policy note are removed. Tool evidence remains available through an inline Activity disclosure, expanded during work/errors and collapsed after successful completion. The header sparkle uses a solid turquoise surface. Empty conversations start at the welcome heading; streamed and restored messages scroll within the conversation, preserving the composer position.


## Shared workspace identity

The global sidebar uses a compact HUMAIN Workspace / People operations card with a turquoise building icon and a settings-link arrow. It is a real navigation link to workspace settings and closes the global mobile drawer after selection. The previous synthetic organization label and nonfunctional dropdown affordance are removed. Dataset provenance remains visible in relevant data views. The card uses shared typography, restrained gradients, an explicit focus ring and hover border treatment across every route.


## Global Inter typography

Inter Variable is bundled and served locally through Fontsource, with real 100–900 weights and optical sizing. Arabic keeps the existing system fallback; code/identifiers keep a monospace face. OFL license ships in public/fonts/Inter-OFL.txt. A final shared typography layer gives body/secondary/accent/status text clear, opaque tones within the existing HUMAIN palette. Headings use 600, controls 500 and small metadata 500–600. Layout grids, dimensions, spacing, surfaces, borders, illustrations and behavior remain intact. Brand wordmarks remain vector/raster assets rather than the body font; LIFECYCLE now uses filled geometric capitals matching CHAT's weight.

Forced grayscale smoothing is removed in favor of native rendering. Text shadows, modal backdrop blur, faded busy-upload containers and control-wide disabled opacity are removed; disabled controls retain their native disabled behavior and distinct text treatment. Small important metadata has a readable 10px floor. Gradient headings retain their teal/green identity with legible stops. The three selected Overview metric footer rows and the selected Analytics evaluation note are omitted; metrics, the 90-day query and Baseline needed state remain unchanged.


The selected secondary captions are removed from the four shared Settings/Integrations connection cards and from the Email settings heading. Connection badges, inputs, health refresh and simulation labels remain. The chat welcome is shortened to Welcome to HUMAIN Chat, and the composer keyboard hint is omitted while Enter/Shift+Enter behavior is retained. The selected Analytics note is omitted while measured values and Baseline needed remain visible.
