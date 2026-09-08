"""HTTP contract tests.

The frontend reads `data.error` and checks `res.ok`. Both exception handlers
exist to keep that shape, so these assert the envelope as much as the payload.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tutor_os.server import app


@pytest.fixture
def client(workspace: Path) -> TestClient:
    # raise_server_exceptions=False so the registered handlers run, the way
    # they do under uvicorn, instead of the exception bubbling into the test.
    return TestClient(app, raise_server_exceptions=False)


class TestErrorEnvelope:
    def test_missing_field_is_a_400_with_error_key(self, client: TestClient):
        response = client.post("/api/thread/delete", json={})
        assert response.status_code == 400
        assert response.json() == {"error": "threadId required"}

    def test_multiple_missing_fields_are_named(self, client: TestClient):
        response = client.post("/api/thread/rename", json={})
        assert response.status_code == 400
        assert response.json() == {"error": "threadId and title required"}

    def test_unhandled_error_is_a_500_with_error_key(self, client: TestClient):
        """Anything a handler raises still reaches the frontend as {"error": ...}."""
        response = client.post(
            "/api/workspace/write",
            json={"slug": "../escape", "path": "x.md", "content": "payload"},
        )
        assert response.status_code == 500
        assert "error" in response.json()
        assert "outside the bounds" in response.json()["error"]

    def test_error_body_never_uses_fastapis_detail_key(self, client: TestClient):
        """FastAPI's default is {"detail": ...}; the frontend reads .error."""
        response = client.post("/api/thread/clear", json={})
        assert "detail" not in response.json()


class TestReadEndpoints:
    def test_status_lists_every_agent_with_its_tools(self, client: TestClient):
        body = client.get("/api/status").json()
        assert body["status"] == "online"

        agents = {a["id"]: a for a in body["agents"]}
        assert "tutor" in agents
        assert agents["tutor"]["tools"], "tutor must expose its tool names"

    def test_memory_graph_reports_the_three_layers(self, client: TestClient):
        body = client.get("/api/memory/graph").json()
        assert set(body) >= {"l1", "l2", "l3", "stats"}
        assert set(body["stats"]) >= {
            "totalL1Traces",
            "totalL2Evidences",
            "verifiedCapabilities",
            "auditHealthScore",
        }

    def test_workspace_returns_projects_and_os_files(self, client: TestClient):
        body = client.get("/api/workspace").json()
        assert set(body) >= {"projects", "archivedProjects", "now", "inbox"}

    def test_threads_bootstraps_a_default_session(self, client: TestClient):
        threads = client.get("/api/threads").json()["threads"]
        assert threads, "a first visit should get a session, not an empty list"
        assert {"id", "title", "messageCount"} <= set(threads[0])


class TestWorkspaceLifecycle:
    def test_init_write_read_archive_restore_delete(self, client: TestClient):
        created = client.post(
            "/api/workspace/init",
            json={
                "slug": "lifecycle",
                "title": "Lifecycle",
                "objective": "exercise the whole path",
                "stack": "python",
            },
        ).json()
        assert "SPEC.md" in created["created"]

        client.post(
            "/api/workspace/write",
            json={"slug": "lifecycle", "path": "01-topology/map.md", "content": "# map"},
        )
        read = client.get(
            "/api/workspace/file", params={"slug": "lifecycle", "path": "01-topology/map.md"}
        ).json()
        assert read["content"] == "# map"

        assert client.post(
            "/api/workspace/archive", json={"slug": "lifecycle", "action": "archive"}
        ).json()["ok"]
        assert "lifecycle" in [
            p["slug"] for p in client.get("/api/workspace").json()["archivedProjects"]
        ]

        client.post("/api/workspace/archive", json={"slug": "lifecycle", "action": "restore"})
        assert client.post("/api/workspace/delete", json={"slug": "lifecycle"}).json()["ok"]
        assert not client.get("/api/workspace").json()["projects"]

    def test_phase_update_is_persisted(self, client: TestClient):
        client.post(
            "/api/workspace/init",
            json={
                "slug": "phased",
                "title": "Phased",
                "objective": "track the phase",
                "stack": "rust",
            },
        )
        client.post(
            "/api/workspace/phase", json={"slug": "phased", "phase": 3, "status": "pausado"}
        )

        project = next(
            p for p in client.get("/api/meta/overview").json()["projects"] if p["slug"] == "phased"
        )
        assert project["phase"] == 3
        assert project["status"] == "pausado"


class TestThreadLifecycle:
    def test_create_rename_clear_delete(self, client: TestClient):
        thread_id = client.post("/api/thread/create", json={"title": "Scratch"}).json()["threadId"]

        assert client.post(
            "/api/thread/rename", json={"threadId": thread_id, "title": "Renamed"}
        ).json()["ok"]
        titles = {t["id"]: t["title"] for t in client.get("/api/threads").json()["threads"]}
        assert titles[thread_id] == "Renamed"

        assert client.post("/api/thread/clear", json={"threadId": thread_id}).json()["ok"]
        assert client.post("/api/thread/delete", json={"threadId": thread_id}).json()["ok"]
        assert thread_id not in {t["id"] for t in client.get("/api/threads").json()["threads"]}


class TestMemoryMutations:
    def test_observation_add_and_delete(self, client: TestClient):
        added = client.post(
            "/api/memory/observation/add",
            json={"tag": "Preference", "text": "paper before IDE"},
        ).json()
        assert added["ok"]

        deleted = client.post(
            "/api/memory/observation/delete", json={"index": added["totalObservations"] - 1}
        ).json()
        assert deleted["ok"]
        assert len(deleted["observations"]) == added["totalObservations"] - 1

    def test_evidence_create_verifies_its_capability(self, client: TestClient):
        client.post(
            "/api/memory/evidence/create",
            json={
                "claim": "batching cuts p99 by 4x",
                "metric": "p99 1.4ms",
                "arcId": "arc1_behavior",
                "capabilityId": "cap-lock-contention",
            },
        )
        caps = {
            c["id"]: c
            for arc in client.get("/api/memory/graph").json()["l3"]["arcs"]
            for c in arc["capabilities"]
        }
        assert caps["cap-lock-contention"]["verified"]
        assert caps["cap-lock-contention"]["evidenceIds"]

    def test_evidence_delete_unlinks_arc_and_unverifies(self, client: TestClient):
        created = client.post(
            "/api/memory/evidence/create",
            json={
                "claim": "batching cuts p99 by 4x",
                "metric": "p99 1.4ms",
                "arcId": "arc1_behavior",
                "capabilityId": "cap-lock-contention",
            },
        ).json()
        ev_id = created["evidence"]["id"]

        del_res = client.post("/api/memory/evidence/delete", json={"id": ev_id}).json()
        assert del_res["ok"]

        caps = {
            c["id"]: c
            for arc in client.get("/api/memory/graph").json()["l3"]["arcs"]
            for c in arc["capabilities"]
        }
        assert not caps["cap-lock-contention"]["verified"]
        assert ev_id not in caps["cap-lock-contention"]["evidenceIds"]

    def test_arc_delete_cleans_linked_evidence(self, client: TestClient):
        client.post(
            "/api/memory/evidence/create",
            json={
                "claim": "test claim for arc delete",
                "arcId": "arc1_behavior",
                "capabilityId": "cap-lock-contention",
            },
        )
        del_res = client.post("/api/arc/delete", json={"arcId": "arc1_behavior"}).json()
        assert del_res["ok"]

        graph = client.get("/api/memory/graph").json()
        arc_ids = [a["id"] for a in graph["l3"]["arcs"]]
        assert "arc1_behavior" not in arc_ids
        for ev in graph["l2"]:
            assert ev.get("arcId") != "arc1_behavior"

    def test_memory_full_purge(self, client: TestClient):
        client.post(
            "/api/memory/observation/add",
            json={"tag": "Note", "text": "to be purged"},
        )
        client.post(
            "/api/memory/evidence/create",
            json={
                "claim": "to be purged claim",
                "arcId": "arc1_behavior",
                "capabilityId": "cap-lock-contention",
            },
        )
        purge_res = client.post("/api/memory/purge").json()
        assert purge_res["ok"]

        mem = client.get("/api/memory").json()
        assert all(o["text"] != "to be purged" for o in mem["observations"])
        assert mem["episodes"] == []

        graph = client.get("/api/memory/graph").json()
        assert graph["l2"] == []
        caps = [
            c
            for arc in graph["l3"]["arcs"]
            for c in arc["capabilities"]
        ]
        assert all(not c.get("verified") for c in caps)

    def test_no_cache_headers_present(self, client: TestClient):
        res = client.get("/api/memory")
        assert res.headers.get("cache-control") == "no-cache, no-store, must-revalidate"
        assert res.headers.get("pragma") == "no-cache"
        assert res.headers.get("expires") == "0"

    def test_workspace_reset_clears_threads_and_leaks(self, client: TestClient):
        client.post("/api/thread/create", json={"title": "Leaked thread"})
        threads_before = client.get("/api/threads").json()["threads"]
        assert any(t["title"] == "Leaked thread" for t in threads_before)

        reset_res = client.post("/api/workspace/reset").json()
        assert reset_res["ok"]

        threads_after = client.get("/api/threads").json()["threads"]
        assert all(t["title"] != "Leaked thread" for t in threads_after)

    def test_workspace_export_and_import_clears_prior_threads(self, client: TestClient):
        exp_res = client.get("/api/workspace/export")
        assert exp_res.status_code == 200
        assert "X-Backup-Path" in exp_res.headers
        zip_bytes = exp_res.content
        assert len(zip_bytes) > 0

        client.post("/api/thread/create", json={"title": "Old workspace thread"})

        imp_res = client.post(
            "/api/workspace/import",
            content=zip_bytes,
            headers={"Content-Type": "application/zip"},
        ).json()
        assert imp_res["ok"]

        threads = client.get("/api/threads").json()["threads"]
        assert all(t["title"] != "Old workspace thread" for t in threads)

    def test_observation_delete_by_tag_or_text(self, client: TestClient):
        client.post(
            "/api/memory/observation/add",
            json={"tag": "UniqueTag", "text": "Unique text to delete"},
        )
        del_res = client.post(
            "/api/memory/observation/delete",
            json={"tag": "UniqueTag", "text": "Unique text to delete"},
        ).json()
        assert del_res["ok"]
        assert all(o.get("tag") != "UniqueTag" for o in del_res["observations"])

