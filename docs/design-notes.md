# Design notes

## What was wrong with the first hero

The first vinplain hero was a startup template: a soft gradient, a rounded dark card with traffic-light dots, a fake terminal, and three pill badges. It looked like the default output of a landing-page generator. That is the opposite of what a public-records tool should look like.

The tells were specific:

- **Gradient and glow.** Decoration that carries no information.
- **Pills.** "NO API KEY / ZERO RUNTIME DEPS / MIT" as rounded capsules. They exist to look like product features, not to be read.
- **Fake terminal.** A code card with window dots is a visual convention borrowed from marketing pages, not from the tool.
- **Rounded card + shadow.** The generic SaaS container.
- **A wordmark in a default grotesque with a coloured period.** Competent, but it could belong to any developer tool.

The Wikipedia definition of AI slop is useful here: *superficial competence, asymmetric effort, mass producibility*. The hero had superficial competence. It did not show the work.

## What elmulator does well

elmulator is a good README because it is specific:

- A custom wordmark and real architecture diagrams, not stock illustrations.
- A quickstart with several real ways to use the tool.
- A comparison with the closest alternative.
- A scenario format section, a layout section, standards, provenance, and limitations.
- No gradient, no pills, no fake dashboard.

It earns trust by showing the mechanism. The vinplain README should do the same: show the record, not a rendering of a product page.

## The new direction: a public record

A VIN is a 17-character public identifier. The product reads public records. The artwork should be a record.

- **The VIN is the hero.** Seventeen cells, one per character, with position nine in red. That is the check digit, the only position with a mathematical guarantee.
- **Real data.** The fields below the VIN come from an actual `vinplain` run: 2003 Honda Accord EX-V6, 24 recall campaigns, 2013 complaints, 22 mpg combined. Nothing is invented for the artwork.
- **No containers that do not mean anything.** Cells are cells. Rules are rules. There are no pills, cards within cards, or window chrome.
- **One accent.** Red marks the check digit and nothing else. It is also the colour of a safety record, not a brand gradient.
- **Cool paper, not warm paper.** The portfolio uses warm cream and orange; elmulator uses paper and orange. vinplain uses cool white/near-black and red, so it belongs to the same author without repeating either.
- **Grotesque + mono.** The wordmark is a tight Helvetica; the record is set in mono. That is a public-form pairing, not a SaaS pairing.
- **No fake UI.** The terminal is gone. The CLI output belongs in the README as text, where it can be copied.

## Rules for the README

1. Show a real result before explaining the architecture.
2. Keep the quickstart runnable.
3. Put the failure model (`null` vs `[]`) in the first screen of documentation, because it is the product's main promise.
4. Compare with the actual alternatives: offline decoders, NHTSA-only wrappers, paid history APIs.
5. Document limits: US only, no history, no listings, government APIs can be slow.
6. No marketing claims, no adoption numbers, no testimonials, no badges beyond CI, release, license.
7. Every code block must run.

## References

- Wikipedia, [AI slop](https://en.wikipedia.org/wiki/AI_slop): superficial competence, asymmetric effort, mass producibility.
- International Typographic Style: grid, asymmetry, flush-left text, one typeface family, content-derived form.
- elmulator's README: mechanism-first, multiple real quickstarts, comparison, limitations.
- Public forms and vehicle records: field labels, fixed-width identifiers, check digits, provenance lines.
