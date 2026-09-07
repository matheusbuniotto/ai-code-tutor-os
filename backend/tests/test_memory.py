"""Round-trips each memory layer: working memory, episodes, observations, audit graph."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tutor_os.markdown import replace_section
from tutor_os.storage import append_jsonl, read_json, read_jsonl, read_text, write_json, write_text


class TestStorageHelpers:
    def test_write_text_creates_parents(self, workspace: Path):
        target = workspace / "deep" / "nested" / "file.md"
        write_text(target, "hello")
        assert target.read_text(encoding="utf-8") == "hello"

    def test_read_text_returns_default_when_missing(self, workspace: Path):
        assert read_text(workspace / "nope.md", "fallback") == "fallback"

    def test_read_json_returns_default_when_missing(self, workspace: Path):
        assert read_json(workspace / "nope.json", []) == []

    def test_read_json_returns_default_when_corrupt(self, workspace: Path):
        corrupt = workspace / "bad.json"
        write_text(corrupt, "{not json")
        assert read_json(corrupt, {"safe": True}) == {"safe": True}

    def test_read_json_distinguishes_empty_from_missing(self, workspace: Path):
        """An empty list is real data, not an absent file — the difference decides
        whether callers fall back to their defaults."""
        empty = workspace / "empty.json"
        write_json(empty, [])
        assert read_json(empty) == []
        assert read_json(workspace / "missing.json") is None

    def test_jsonl_append_and_read(self, workspace: Path):
        path = workspace / "log.jsonl"
        append_jsonl(path, {"n": 1})
        append_jsonl(path, {"n": 2})
        assert read_jsonl(path) == [{"n": 1}, {"n": 2}]


class TestMarkdownSections:
    DOC = "# Title\n\n## Alpha\nold alpha\n\n## Beta\nold beta\n"

    def test_replaces_only_the_named_section(self):
        out = replace_section(self.DOC, "## Alpha", "new alpha")
        assert "new alpha" in out
        assert "old alpha" not in out
        assert "old beta" in out

    def test_appends_when_section_absent(self):
        out = replace_section(self.DOC, "## Gamma", "fresh")
        assert "## Gamma\nfresh" in out
        assert "old alpha" in out

    def test_matches_header_with_a_decorated_suffix(self):
        doc = "## Profile (elevated GAI)\nold\n\n## Next\nkeep\n"
        out = replace_section(doc, "## Profile", "new")
        assert "new" in out and "old" not in out and "keep" in out

    def test_content_with_regex_backreferences_is_literal(self):
        """Agent-authored content containing \\1 must not be treated as a group ref."""
        out = replace_section(self.DOC, "## Alpha", r"see \1 and \g<0>")
        assert r"see \1 and \g<0>" in out


class TestEpisodes:
    def _episode(self, **kw):
        base = {
            "date": "2026-01-01",
            "project_slug": "proj",
            "topic": "wal fsync",
            "phase_reached": 2,
            "status": "concluido",
            "extracted": "group commit amortizes fsync",
            "connections": ["durability"],
        }
        return {**base, **kw}

    def test_append_then_recent(self, meta_dir: Path):
        from tutor_os.tools.episodes import episodes_append, episodes_recent

        episodes_append(**self._episode())
        episodes_append(**self._episode(topic="lock contention"))

        recent = episodes_recent(limit=5)["episodes"]
        assert len(recent) == 2
        assert recent[0]["topic"] == "lock contention", "most recent must come first"

    def test_recent_filters_by_project(self, meta_dir: Path):
        from tutor_os.tools.episodes import episodes_append, episodes_recent

        episodes_append(**self._episode())
        episodes_append(**self._episode(project_slug="other"))

        assert len(episodes_recent(limit=10, project_slug="other")["episodes"]) == 1

    def test_search_matches_topic_extract_and_connections(self, meta_dir: Path):
        from tutor_os.tools.episodes import episodes_append, episodes_search

        episodes_append(**self._episode())

        assert episodes_search("fsync")["matches"], "should match topic"
        assert episodes_search("group commit")["matches"], "should match extracted"
        assert episodes_search("durability")["matches"], "should match connections"
        assert not episodes_search("kubernetes")["matches"]

    def test_delete_by_date_and_project_respects_topic(self, meta_dir: Path):
        from tutor_os.tools.episodes import episodes_append, episodes_delete, read_episodes

        episodes_append(**self._episode(topic="keep me"))
        episodes_append(**self._episode(topic="delete me"))

        episodes_delete(date="2026-01-01", project_slug="proj", topic="delete me")

        remaining = [e["topic"] for e in read_episodes()]
        assert remaining == ["keep me"]

    def test_clear_empties_the_log(self, meta_dir: Path):
        from tutor_os.tools.episodes import episodes_append, episodes_clear, read_episodes

        episodes_append(**self._episode())
        episodes_clear()
        assert read_episodes() == []


class TestObservations:
    def test_defaults_when_file_absent(self, meta_dir: Path):
        from tutor_os.tools.observations import read_observations

        assert read_observations(), "a fresh install should get the calibration defaults"

    def test_deleting_the_last_one_does_not_resurrect_defaults(self, meta_dir: Path):
        """An empty list is a deliberate state; falling back to defaults would
        silently undo the user's deletion on the next read."""
        from tutor_os.tools.observations import (
            observation_delete,
            read_observations,
            write_observations,
        )

        write_observations([{"tag": "only", "text": "one"}])
        observation_delete(0)
        assert read_observations() == []

    def test_capture_appends(self, meta_dir: Path):
        from tutor_os.tools.observations import observation_capture, write_observations

        write_observations([])
        result = observation_capture("Preference", "prefers paper-first")
        assert result["totalObservations"] == 1

    def test_out_of_range_index_raises(self, meta_dir: Path):
        from tutor_os.tools.observations import observation_update, write_observations

        write_observations([])
        with pytest.raises(ValueError):
            observation_update(3, "tag", "text")


class TestWorkingMemory:
    def test_initializes_from_template(self, meta_dir: Path):
        from tutor_os.tools.working_memory import WORKING_MEMORY_PATH, get_working_memory

        assert not WORKING_MEMORY_PATH.exists()
        assert "Learner Profile" in get_working_memory()
        assert WORKING_MEMORY_PATH.exists()

    def test_update_replaces_one_section_only(self, meta_dir: Path):
        from tutor_os.tools.working_memory import get_working_memory, update_working_memory

        update_working_memory("levels-by-stack", "rust: intermediate")
        doc = get_working_memory()
        assert "rust: intermediate" in doc
        assert "## Observed Blockage Patterns" in doc, "other sections must survive"

    def test_injection_reflects_the_latest_write(self, meta_dir: Path):
        """Injection happens per call; a stale read would freeze the profile."""
        from tutor_os.tools.working_memory import inject_working_memory, update_working_memory

        update_working_memory("microvictories", "shipped the tracer bullet")
        assert "shipped the tracer bullet" in inject_working_memory()


class TestAuditGraph:
    def test_starts_with_no_fabricated_evidence(self, meta_dir: Path):
        """A fresh install must not claim an audit trail nobody earned."""
        from tutor_os.tools.memory_audit import get_full_memory_graph

        stats = get_full_memory_graph()["stats"]
        assert stats["totalL2Evidences"] == 0
        assert stats["verifiedCapabilities"] == 0

    def test_recording_evidence_verifies_the_capability(self, meta_dir: Path):
        from tutor_os.tools.arcs import read_arcs_data
        from tutor_os.tools.memory_audit import evidence_record

        result = evidence_record(
            claim="group commit raises throughput 50x",
            metric="42k ops/s",
            capability_id="cap-wal-io-saturation",
            arc_id="arc1_behavior",
        )
        assert result["ok"]

        caps = {c["id"]: c for a in read_arcs_data() for c in a["capabilities"]}
        assert caps["cap-wal-io-saturation"]["verified"]
        assert result["evidenceId"] in caps["cap-wal-io-saturation"]["evidenceIds"]

    def test_audit_health_tracks_unbacked_claims(self, meta_dir: Path):
        """A capability marked verified with no evidence behind it must drag the score down."""
        from tutor_os.tools.arcs import capability_verify
        from tutor_os.tools.memory_audit import get_full_memory_graph

        capability_verify("arc1_behavior", "cap-lock-contention", "trust me")
        assert get_full_memory_graph()["stats"]["auditHealthScore"] == 0

    def test_evidence_list_filters(self, meta_dir: Path):
        from tutor_os.tools.memory_audit import evidence_list, evidence_record

        evidence_record(claim="alpha claim", arc_id="arc1_behavior", surface="benchmark")
        evidence_record(claim="beta claim", arc_id="arc2_systems", surface="code_review")

        assert evidence_list(arc_id="arc1_behavior")["total"] == 1
        assert evidence_list(surface="code_review")["total"] == 1
        assert evidence_list(search="beta")["total"] == 1


class TestLivingLibrary:
    def test_note_is_saved_and_indexed(self, workspace: Path):
        from tutor_os.tools.living_library import (
            LIBRARY_INDEX_PATH,
            library_index,
            library_save_note,
        )

        library_save_note(
            project_slug="wal-bench",
            title="Write-Ahead Logging",
            invariants="fsync is the durability boundary",
            when_to_use="crash-safe writes",
            when_not_to_use="ephemeral caches",
            hidden_traps="fsync per txn saturates the drive",
            proof_artifact="cargo run --release -- --bench-wal",
        )

        index = library_index()
        assert index["totalNotes"] == 1
        assert index["notes"][0]["title"] == "Architecture Note: Write-Ahead Logging"
        assert "wal-bench" in LIBRARY_INDEX_PATH.read_text(encoding="utf-8")

    def test_empty_library_still_writes_an_index(self, workspace: Path):
        from tutor_os.tools.living_library import LIBRARY_INDEX_PATH, library_index

        assert library_index()["totalNotes"] == 0
        assert "No architecture notes" in LIBRARY_INDEX_PATH.read_text(encoding="utf-8")


class TestMetaOverview:
    def test_counts_and_project_scan(self, meta_dir: Path):
        from tutor_os.tools.meta import meta_overview
        from tutor_os.tools.workspace import phase_set, workspace_init

        workspace_init("proj-a", "Project A", "learn something measurable", "rust")
        phase_set("proj-a", 3, "em-andamento")

        overview = meta_overview()
        project = next(p for p in overview["projects"] if p["slug"] == "proj-a")
        assert project["phase"] == 3
        assert project["status"] == "em-andamento"
        assert overview["arcsSummary"]["totalCapabilities"] > 0

    def test_now_goes_stale_when_its_project_disappears(self, meta_dir: Path):
        from tutor_os.tools.meta import meta_overview, meta_set_now

        meta_set_now("ghost-project", "mission", "objective", "next action")
        assert meta_overview()["nowStale"], "NOW pointing at a missing project is stale"

    def test_counts_tolerate_both_stored_shapes(self, meta_dir: Path):
        from tutor_os.tools.meta import EXP_PATH, meta_overview

        write_json(EXP_PATH, {"experiments": [{"id": "exp-1"}, {"id": "exp-2"}]})
        assert meta_overview()["experimentsCount"] == 2

        write_json(EXP_PATH, [{"id": "exp-1"}])
        assert meta_overview()["experimentsCount"] == 1


class TestGate:
    def test_verdict_is_recorded_to_history(self, meta_dir: Path):
        from tutor_os.tools.gate import GATE_HISTORY_PATH, gate_check

        result = gate_check(context="work", topic="rewrite the CI", work_high_abstraction=True)
        assert result["verdict"] == "GO"
        assert result["recorded"]

        logged = [json.loads(line) for line in GATE_HISTORY_PATH.read_text().splitlines()]
        assert logged[-1]["topic"] == "rewrite the CI"

    def test_personal_needs_three_of_four_gates(self, meta_dir: Path):
        from tutor_os.tools.gate import gate_check

        two = gate_check(
            context="personal_study",
            topic="new framework",
            personal_cluster_deepening=True,
            personal_tracer_bullet_fit=True,
        )
        assert two["verdict"] == "POSTPONE_RECORD"

        three = gate_check(
            context="personal_study",
            topic="new framework",
            personal_cluster_deepening=True,
            personal_tracer_bullet_fit=True,
            personal_topology_before_syntax=True,
        )
        assert three["verdict"] == "GO"
