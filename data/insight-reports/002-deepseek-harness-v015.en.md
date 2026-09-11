# DeepSeek Harness v0.1.5, Observed: The Platform Absorbs Base Experiences, and the Ecosystem Stratifies

> DSH Insights · Observation Report #002 · 2026-09-11 · Snapshot data verifiable (/data/) · Compatibility matrix = 2,431 npm-published web-form plugins out of the 10,534-plugin authoritative set × 4 shell versions, per-plugin load-tested · Heuristic evaluation, not a security audit

## Core Judgment

**v0.1.5 is a watershed in dsh's platform history: it marks the formal stratification of the ecosystem into "base experiences built in, differentiation pushed up to the plugin layer."** File tree/preview into the kernel, standardized sidebar extension entries on both sides, models trained jointly with the harness — the platform is consolidating its foundation while leaving the plugin layer a clearer, and higher-bar, position. The damage this release does to the ecosystem is almost never at the API layer (measured compatibility damage: zero); it sits in the **positioning layer, the communication layer, and the distribution layer**: 1,522 base-experience plugins must re-answer "why do I exist" — with no guidance from the official side to help answer it — while the Node silent-failure trap at the npx entry quietly drains the entire ecosystem's new-user funnel.

## 1. The Release's Core Value: Three Storylines

**1. Model × platform co-evolution becomes the product shape.** V4.1 Flash is trained specifically for standard/PTC/minimal modes, plus "update the system prompt while preserving KV Cache" — the model is no longer bolted on but trained into the harness's interaction protocol. This defines dsh's difference from generic agent frameworks: coupled iteration of model behavior and platform capability. What it means for plugin authors: **extension points close to the model-platform protocol have a longer half-life than piled-up UI features.**

**2. Agent organization becomes a first-class primitive.** Bidirectional parent-child agent communication, queued messages/interruptions/stops, and Agent Teams' shared task lists (experimental, off by default). Multi-agent coordination goes from "roll your own" to platform primitive — this is the ecosystem's next opportunity band: team orchestration, progress observation, and inter-member tool routing have no mature plugins yet.

**3. Standardized extension entries.** Registered slots in both sidebars + tabs/splits/fullscreen presentation. Standardized entries historically precede ecosystem booms (see browser extensions) — they lower the installation-intent threshold, but they also fold "placement" value back into the platform.

## 2. Compatibility: A Smooth Upgrade, Proven by Data

Of the 10,534 authoritative-set plugins, 6,859 are not yet on npm (unmeasurable); of the 3,675 published ones, 1,242 are CLI/TUI-form (no client bundle). The remaining **2,431 web-form published plugins'** latest client bundles were load-tested per-plugin against four shells' module tables:

| shell | ok | broken | conditional |
|---|---|---|---|
| 0.0.1-rc.5 (old latest tag) | 2332 | 81 | 0 |
| 0.1.2-rc.1 (mainline installed base) | 2266 | 144 | 3 |
| 0.1.5-alpha.2 / rc.1 | 2266 | 144 | 3 |

**0.1.2 → 0.1.5: zero migration (0 healed, 0 newly broken).** The module tables are identical across the two versions — under a dense cadence of 5 releases, 3 of them breaking, the platform kept the "never remove modules" discipline. That is the most important promise a platform can make an ecosystem, and it deserves to be seen.

Of the 144 long-broken plugins, **132 (92%) fail on a single module that has never been in any released shell's module table** (`@deepseek-ai/dsh-client-runtime/client`). This is less a compatibility problem than an **ecosystem knowledge-distribution problem**: 132 authors hit the same pit independently, while the fix (migrate to `dsh-client-store`, seeded since 0.1.2-alpha.2 with the same-name API) is deterministic and cheap. A pit hit independently 132 times means the ecosystem lacks a distribution layer for fix knowledge — which is more worth building than the module itself.

## 3. The Positioning Shock: 1,522 Plugins Must Re-answer "Who Am I"

The "Sidebar / Workspace" and "File browsing / Preview" categories total **1,522 plugins (14% of the authoritative set)** in direct overlap with this release's built-ins; the top three (dsh-better-sidebar 43k, dsh-univer-office 27k, dsh-context 15k weekly downloads) carry ~85k/week of the ecosystem's base-experience traffic.

Judgment: **this is stratification, not absorption.** Basic browsing/preview is foundation users expect out of the box; consolidating it is net-positive for users, and the plugin layer's viable space moves up one notch — deeper format support, editing, external-system integration, model-protocol-coupled workflows. History (browser extensions, VS Code) suggests the three years after entry standardization are usually an expansion period for plugin ecosystems, not contraction. But **individuals** do face a reshuffle: a plugin indistinguishable from the built-in has a window that ends the moment users notice "it's already built in."

That optimism holds on one precondition, however: **developers believe their investment will still pay off** — and that link is exactly what's missing today. Authors in the overlap zone face a triple uncertainty: they don't know when their next feature gets absorbed, where the built-in boundary is, or how the platform views the demand they just finished validating (top sidebar/preview plugins spent months proving these were real needs; the platform then took them in as base capabilities — without any gesture toward that demand-validation labor, not even an acknowledgement or a suggested migration direction).

**What kills motivation is the uncertainty, not the absorption itself.** A rational plugin author will ask "is this the next thing to be absorbed?" before every investment, and nobody can answer — so they invest less, shift to waiting, long-tail innovation dries up, and the "everything is a plugin" vision is eroded by its own success. This is not hypothetical: whether the absorption-zone's top authors keep shipping updates next week is a leading indicator this observatory will keep tracking.

A note to the official team: the announced "built-in plugin management panel" is the next absorption zone. Please publish its boundary with existing plugin-management tooling ahead of time and leave the ecosystem room to adjust.

## 4. The Distribution Trap: The Whole Ecosystem's New-User Funnel Is Leaking Silently

The `@deepseek-ai/dsh` 0.1.5 CLI entry is guarded by `if (import.meta.main)`, which is `undefined` on older Node — **every command produces zero output and exits 0**. Measured: Node 22.14 / 23.11 / 24.0 / 24.1 fail silently; **24.21 / 25.9 / 26.8 work** (exact introduction version pending official confirmation; see Discussions #6124, 3 independent community confirmations).

This hurts the ecosystem, not just dsh itself: a prospective user runs `npx @deepseek-ai/dsh web` per the announcement, gets nothing, and most likely concludes "dsh doesn't work" rather than "my Node is old" — every plugin's potential installs flow through this one funnel. The fix is trivial (declare engines + a startup guard); the payoff is the entire funnel.

## 5. Announcement Effect: Mildly Positive

On announcement day (09-10), authoritative-set additions by repo creation date: 09-08 82 → 09-09 78 → **09-10: 98** — the week's second-highest (after 09-03's 102). The announcement brought real creator inflow, but the ecosystem's main growth still comes from daily inertia — single-day pulses are not this ecosystem's growth mode; sustained developer experience is.

## 6. Recommendations for Three Parties

**To the dsh team**: ① move dist-tags the moment you ship (npm `latest` long pointed at the ancient 0.0.1-rc.5); ② add an `engines` declaration and a startup guard to kill silent failures (#6124); ③ if `engines.dsh` ever becomes enforced, define prerelease semantics first — literal semver reads `>=0.1.0-rc.6` as incompatible with 0.1.1-rc.x, the opposite of author intent (one author already dropped the declaration over this); ④ make the "never remove modules" discipline a public commitment — you already kept it this release; saying so out loud is worth more; ⑤ **pre-announce the absorption roadmap 1–2 releases ahead** and publish a "built-in boundary manifesto": the platform takes only the open-out-of-the-box base layer; depth, editing, and integration permanently belong to plugins — give the ecosystem certainty; ⑥ **take an official posture toward overlapped head plugins**: recommend alternatives, invite co-building, or at least publicly acknowledge their demand-validation work. A migration guide costs far less than losing a cohort of head authors.

**To plugin authors**: the window for the base-experience commodity zone (browsing/preview/simple sidebars) is closing — move toward what the built-ins won't do: deep formats, editing, cross-system integration, protocol-coupled orchestration; prefer runtime capability detection over static version declarations; and the 132-pit fix is a deterministic one-line migration — the earlier, the better.

**To users**: measured upgrade compatibility risk is zero — upgrade with confidence; check `node --version` first (< 24.21 fails silently; a Node upgrade resolves it).

**About this site**: DSH Insights (dsh-insights.com) is an independent observatory of the dsh ecosystem: plugin health grades, a measured compatibility matrix, a known-fix case library, and periodic ecosystem reports — data, rules, and pipeline fully open source, every conclusion traceable to raw data. Plugin authors can audit every scoring basis on their detail page and pick up a free README health badge; every number in this report comes from its public snapshots.

---

*Data & method: the compatibility matrix = static require-literal extraction from each latest-published client bundle × shell module-table three-state verdict (ok/conditional/broken), fully cached, incrementally refreshed daily; downloads are npm weekly windows; categories come from the six-dimension scoring framework. Raw data: /data/compat-observed.json, /data/downloads.json, /data/fixes.json. DSH Insights is an independent observatory with no affiliation to DeepSeek; the judgment sections are heuristic and welcome rebuttal (open an issue).*
