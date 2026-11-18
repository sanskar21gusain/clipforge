# Decisions Made Autonomously (`NEEDS_DECISION.md`)

Every conservative assumption or product decision made during the autonomous overnight run is logged below so you can review or adjust it in the morning.

---

### D-001: Placement of `pre-overnight` Git Tag
- **Context:** Before starting Phase 1, the working tree contained the already-approved QA audit fixes (`QA-001`–`QA-016`, `QA-019`, `QA-020`) uncommitted on top of `main` (`7536db6`). The safety rails prohibit touching `main`.
- **Choice Made:** Switched to `feature/overnight-v2` first, committed those approved QA fixes as `f8c97fc`, and placed the `pre-overnight` tag on `f8c97fc`.
- **Why:** Keeps `main` 100% untouched while ensuring rolling back to `pre-overnight` returns to the exact verified QA-passing state right before tonight's features began.
