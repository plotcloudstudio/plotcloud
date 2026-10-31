# Public-page UI unification

Audience and task: visitors comparing PlotCloud's capabilities and access options, browsing resources, or logging in/registering should recognize the same product and keep a consistent navigation path. The existing pages used different typography, navigation and button treatments from Home. This change shares Home's public navigation and applies its blue-grey palette, type hierarchy, card treatment, controls, spacing and footer to Pricing, About, Blog, Resources and both authentication modes.

Implementation: public-chrome.js supplies shared navigation and a persistent page container. The router renders public pages into that container; login's existing tab redraws affect only its content, preserving navigation. Resource catalog filters, details, utilities and access gates keep their existing handlers. Embedded resource engines retain their own internal UI with the public navigation outside. Import-map and entry-point versions are aligned to avoid two router module instances.

Content and access: current prices, beta terms, account/provider operations, source-file availability, permissions, project data and simulations are retained. About and Blog reuse the existing homepage illustration assets as visual context. Get started opens the existing signup mode with the new-project return destination.

Validation: JavaScript syntax and whitespace checks passed. Browser inspection verified all six page variants at desktop and 390px without horizontal overflow; one public navigation per page; signup/login switching retains navigation and changes required fields and password autocomplete correctly; Resources search for chair yields its catalog result and opens its detail page; a restricted resource tool shows its existing access gate inside the public shell; returning Home removes public-page styling and preserves its dark hero. No account was created, no sign-in email was sent and no payment was submitted during UI verification.

