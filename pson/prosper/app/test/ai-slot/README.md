# AI slot (mock-up)

Design for the AI summary and chat panel inside card layout B. Static mock: all AI text is hand-written sample text (`samples.js`), clearly labelled "Sample". No AI service or external AI link is called; asking a question returns a canned sample reply offline.

- `ai-slot.js`: `AISlot.panel(vm, sample, { tab: 'summary'|'ask', state: 'ready'|'loading'|'nokey'|'error' })`. The page swaps it in for `Cards.ai` before rendering `Layouts.B`, so the card code is unchanged.
- Summary tab: two short paragraphs, three key points with chips that jump to the card section they come from, a "check before relying on it" note, and Copy / Regenerate / feedback controls.
- Ask tab: thread, suggested questions, input. Answers use only the card's data ("Likely" where it's an inference).
- Violet/amber appear only inside the AI panel (edge, spark, shimmer). The model tier shown is Haiku.
- URL: `?co=<number>&state=ready|ask|loading|nokey|error`.
