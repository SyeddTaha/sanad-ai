# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root, or
- **`GLOSSARY-MAP.md`** at the repo root if it exists
- **`docs/adr/`**: read ADRs that touch the area being worked in

If these files don't exist, proceed silently. Do not flag their absence or suggest creating them upfront.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md
├── docs/adr/
│   └── 0001-example.md
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is not in the glossary, reconsider whether project language is being invented or note the gap for `/domain-modeling`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding the decision.
