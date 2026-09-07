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
