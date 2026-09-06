# DSH Insights — The DeepSeek Harness Ecosystem Observatory

> **Live: <https://dsh-insights.com>** · This repo = pipeline + site + open data ([ice5kysl/dsh-insights](https://github.com/ice5kysl/dsh-insights))
> **Plugin health · Official dynamics · Ecosystem trends** — full-ecosystem indexing → authenticity gate → objective health scores (evidence attached) → channel coverage → letters to authors → weekly report → official-dynamics snapshots (+ rc compat radar, M2). Zero-dependency Node. Open and reproducible.
>
> **English (default)** · [简体中文](./README.zh-CN.md) · Docs: [Vision](./docs/VISION.md) · [Roadmap](./docs/ROADMAP.md) · [Product Plan](./docs/PRODUCT-PLAN.md) · [Product Design](./docs/PRODUCT-DESIGN.md) · [Research](./docs/RESEARCH.md) · [Schema](./docs/SCHEMA.md) · [Outreach](./docs/OUTREACH.md) · Per-plugin CLI [dsh-plugin-health](https://github.com/ice5kysl/dsh-plugin-health)

## Why

The `dsh-plugin` topic went from zero to **13,700+ repos in about a month**. Discovery is solved (awesome lists, marketplaces) — **trust is not**: duplicates, abandoned forks, non-installable bundles and compat risk are the real user cost, and nobody scores any of it. The official directory explicitly opts out of ranking.

DSH Insights is the missing evaluation layer: **every plugin gets an honest, reproducible number.**

## The three layers

| Layer | What | Delivered as |
|---|---|---|
| **L1 · Plugin insights** | Authenticity gate (manifest) → authoritative set → health score **S–D / 0–100** (health-v4, per-deduction evidence) → channel coverage → "quality unlisted" list | Snapshot data + site + per-plugin pages + letters |
| **L2 · Official dynamics** (v0 live) | dsh releases/rc cadence, dist-tags, DeepSeek platform signals; rc compat radar (M2) | `/dynamics` + weekly official section |
| **L3 · Ecosystem reports** | Weekly report (every Friday, CI-generated) + a "letter to the author" per plugin (outreach material) | `/weekly` + RSS + `data/reports/` |

Not another directory or marketplace — a data & observation source for directories, marketplaces, agents and the dsh team to build on.

## Site

Home (search + KPI + latest arrivals + scenario shortcuts) · [Dashboard](https://dsh-insights.com/dashboard/) (trends/quality/rankings + full plugin library `#browse`) · Plugin pages [`/p/<owner>/<repo>/`](https://dsh-insights.com/p/ice5kysl/dsh-workspace-kit/) (objective data for **every** authoritative plugin) · [Scenarios](https://dsh-insights.com/scenarios/) · [Authors](https://dsh-insights.com/authors/) · [Weekly](https://dsh-insights.com/weekly/) (reader with MD/PDF/PNG export) · [Dynamics](https://dsh-insights.com/dynamics/) · [Badges](https://dsh-insights.com/badge/) · [Open data](https://dsh-insights.com/data/) · [About/methodology](https://dsh-insights.com/about/) · [RSS](https://dsh-insights.com/feed.xml). Dark/light theme toggle, readable without JS, `llms.txt` for agents.

## Data outputs (open)

| File | What |
|---|---|
| `data/plugins.jsonl` · `invalid.jsonl` | **Authoritative set 9,141** + 3,642 noise buckets (0 duplicates · hard gate · 2026-09-06 snapshot, validation still rolling) |
| `data/insights.json` + `insights.schema.json` | Agent contract (stable URL, additive-only schema) |
| `data/analysis.json` · `enrich.json` · `plugins.csv` | Aggregates / per-plugin scores+channels / spreadsheet |
| `data/dynamics.json` · `metrics.jsonl` | Official-dynamics snapshot · product self-metrics |
| `data/llm.jsonl` · `data/reports/*.md` · `data/weekly/*.md` | LLM capability tags · letters to authors · weekly issues |

License: **code MIT · data CC BY 4.0** (attribution: dsh-insights.com). Repo metadata (descriptions etc.) remains © its original authors.

## Pipeline

```
collect    discover (sharded full crawl) · npm-map · lists · downloads · dynamics · refresh (metadata merge)
validate   validate (authenticity → set/buckets, resumable) · regress (calibration gate) · deep (sampled write-face/sanitizer)
analyze    analyze (→ enrich) · score · history · compat · overlap · llm-tags · scenarios
publish    site (dashboard) · pages (home/p/weekly/dynamics/scenarios/authors/badge/data/about) · exports · badges · diff
content    letters (outreach material) · weekly
```

One orchestrator (`bin/pipeline.mjs`):

```bash
node bin/pipeline.mjs daily      # CI daily (light refresh)
node bin/pipeline.mjs friday     # daily + discover/refresh + author-graph + metrics + letters + weekly (CI Fridays)
node bin/pipeline.mjs snapshot   # analyze → publish full chain
node bin/pipeline.mjs full       # discovery → validation → snapshot
node bin/pipeline.mjs --only score,badges / --from analyze / --dry
```

Quick start:

```bash
GITHUB_TOKEN="$(gh auth token)" node bin/pipeline.mjs full   # first full run
node bin/query.mjs --sort stars --top 10                     # query the set
node bin/recheck.mjs owner/repo                              # force re-validate one plugin
node bin/check-docs.mjs                                      # README ↔ data reconciliation
```

CI (`.github/workflows/refresh.yml`): single cron 03:07 UTC, Friday profile switched in-job, concurrency-grouped; deploys via `workflow_run`. `recheck.yml` lets authors trigger a re-check of their plugin from Actions.

## Scoring in one paragraph

Start at 100, deduct per rule (fail −20 / major −10 / warn −5 / minor −2), every deduction carries evidence; missing data is never invented or penalized; stars never enter the score; LLM output is display-only. Grades **S ≥95 · A ≥90 · B ≥75 · C ≥60 · D <60**. Heuristic assessment, **not a security audit** — deep inspection (write-face/sanitizer) is a separate, clearly-labeled signal. Disputes: [issue templates](.github/ISSUE_TEMPLATE/) (ZH/EN both fine).

## Status (2026-09-06)

- [x] Full crawl + validation: 14,331 candidates → **9,141** authoritative (0-duplicate hard gate; resumable, still rolling)
- [x] Site live (custom domain, dark/light, search, SEO basics, analytics); per-plugin pages for the full set; weekly reader with MD/PDF/PNG export
- [x] Health v4 (S-grade added) + calibration regression in snapshot gate; audit backlog closed (see `docs/AUDIT-2026-09-06.md`)
- [x] Metadata refresh loop (Tier 0) wired into Fridays; letters frozen to snapshot dates (diff-driven pages)
- [ ] M1 exit remaining: contract-field survey · i18n detector (ja/ko/es) · weekly outreach (≥2 issues public, W37 = first)
- [ ] M2 remaining: rc compat radar (v1 API-symbol route) · official timeline ≥4 weeks

## Contributing

- **Plugin authors**: check your page at `/p/<owner>/<repo>/`, embed the badge, [request a re-check](https://github.com/ice5kysl/dsh-insights/actions/workflows/recheck.yml), appeal scores or correct data via issues (ZH/EN both fine).
- **Curators / agents**: consume `/data/insights.json` (join key `owner/repo`, additive schema, CC BY 4.0).
- Everything is generated by an open pipeline — clone and reproduce any number.
