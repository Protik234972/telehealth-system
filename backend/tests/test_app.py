import copy
import unittest
from datetime import datetime
from bson import ObjectId
from fastapi.testclient import TestClient

import backend.main as main_module


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _UpdateResult:
    def __init__(self, modified_count):
        self.modified_count = modified_count


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, field, direction=1):
        reverse = direction < 0
        self._docs.sort(key=lambda d: d.get(field, datetime.min), reverse=reverse)
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    async def to_list(self, length=100):
        return [copy.deepcopy(d) for d in self._docs[:length]]


class FakeCollection:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        if not query:
            return True
        for k, v in query.items():
            val = doc.get(k)
            if isinstance(v, dict):
                if "$in" in v and val not in v["$in"]:
                    return False
                if "$ne" in v and val == v["$ne"]:
                    return False
                if "$gte" in v and (val is None or val < v["$gte"]):
                    return False
            else:
                if val != v:
                    return False
        return True

    async def find_one(self, query=None, sort=None):
        matches = [d for d in self.docs if self._matches(d, query or {})]
        if not matches:
            return None
        if sort:
            field, direction = sort[0]
            matches.sort(key=lambda d: d.get(field, datetime.min), reverse=(direction < 0))
        return copy.deepcopy(matches[0])

    def find(self, query=None, projection=None):
        matches = [copy.deepcopy(d) for d in self.docs if self._matches(d, query or {})]
        if projection:
            projected = []
            for d in matches:
                item = {}
                for k, inc in projection.items():
                    if inc and k in d:
                        item[k] = d[k]
                projected.append(item)
            matches = projected
        return _FakeCursor(matches)

    async def insert_one(self, doc):
        stored = copy.deepcopy(doc)
        if "_id" not in stored:
            stored["_id"] = ObjectId()
        self.docs.append(stored)
        return _InsertResult(stored["_id"])

    async def update_one(self, query, update):
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = copy.deepcopy(v)
                return _UpdateResult(1)
        return _UpdateResult(0)

    async def count_documents(self, query=None):
        return sum(1 for d in self.docs if self._matches(d, query or {}))

    def aggregate(self, pipeline):
        counts = {}
        for d in self.docs:
            key = d.get("ai_urgency_score")
            counts[key] = counts.get(key, 0) + 1
        return _FakeCursor([{"_id": k, "count": v} for k, v in counts.items()])


class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.appointments = FakeCollection()
        self.preemption_log = FakeCollection()
        self.audit_logs = FakeCollection()


class TelehealthAPITests(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeDB()
        self.orig_db = main_module.db
        self.orig_smtp = (main_module.SMTP_EMAIL, main_module.SMTP_PASSWORD)
        main_module.db = self.fake_db
        main_module.SMTP_EMAIL = ""
        main_module.SMTP_PASSWORD = ""
        self.client = TestClient(main_module.app)

    def tearDown(self):
        main_module.db = self.orig_db
        main_module.SMTP_EMAIL, main_module.SMTP_PASSWORD = self.orig_smtp

    def _register_and_login(self, username="alice", password="password123", role="patient"):
        res = self.client.post(
            "/register",
            json={
                "username": username,
                "password": password,
                "email": f"{username}@example.com",
                "mobile": "+60123456789",
                "role": role,
            },
        )
        self.assertEqual(res.status_code, 200)
        login_res = self.client.post(
            "/login",
            data={"username": username, "password": password},
        )
        self.assertEqual(login_res.status_code, 200)
        return login_res.json()

    def test_register_forces_patient_role(self):
        login_data = self._register_and_login(username="attacker", role="admin")
        self.assertEqual(login_data["role"], "patient")
        self.assertEqual(self.fake_db.users.docs[0]["role"], "patient")

    def test_rbac_blocks_cross_role_access(self):
        patient_login = self._register_and_login(username="pat1")
        pat_headers = {"Authorization": f"Bearer {patient_login['access_token']}"}

        self.assertEqual(self.client.get("/analytics", headers=pat_headers).status_code, 403)
        self.assertEqual(
            self.client.patch(
                f"/override-priority/{ObjectId()}",
                json={"new_priority": "Urgent", "reason": "test"},
                headers=pat_headers,
            ).status_code,
            403,
        )

    def test_symptom_min_length_validation(self):
        patient_login = self._register_and_login(username="pat2")
        headers = {"Authorization": f"Bearer {patient_login['access_token']}"}
        res = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Pat Two",
                "contact_info": "pat2@example.com",
                "symptom_text": "short",
            },
            headers=headers,
        )
        self.assertEqual(res.status_code, 422)

    def test_triage_cases_and_emergency_preemption(self):
        patient_login = self._register_and_login(username="pat3")
        headers = {"Authorization": f"Bearer {patient_login['access_token']}"}

        # TC-02: Routine
        r_routine = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Alice Routine",
                "contact_info": "alice@example.com",
                "symptom_text": "I need a routine blood pressure follow up appointment, and need my medication prescription refilled with a standard prescription.",
            },
            headers=headers,
        )
        self.assertEqual(r_routine.status_code, 200)
        self.assertEqual(r_routine.json()["urgency"], "Routine")

        # TC-04: Informal Urgent syntax
        r_urgent = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Bob Urgent",
                "contact_info": "bob@example.com",
                "symptom_text": "Head hurts rly bad cant sleep coughing alot feeling terrible since yesterday.",
            },
            headers=headers,
        )
        self.assertEqual(r_urgent.status_code, 200)
        self.assertEqual(r_urgent.json()["urgency"], "Urgent")

        # TC-03: Emergency triggers preemption of earliest pending non-emergency slot
        r_emerg = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Charlie Emergency",
                "contact_info": "charlie@example.com",
                "symptom_text": "I am experiencing severe crushing chest pain, coming down my left arm, and I suddenly have a lot of difficulty breathing.",
            },
            headers=headers,
        )
        self.assertEqual(r_emerg.status_code, 200)
        self.assertEqual(r_emerg.json()["urgency"], "Emergency")
        self.assertIsNotNone(r_emerg.json()["appointment_details"]["ai_confidence"])
        self.assertEqual(len(self.fake_db.preemption_log.docs), 1)
        self.assertEqual(self.fake_db.preemption_log.docs[0]["bumped_patient"], "Bob Urgent")

    def test_override_priority_writes_audit_log(self):
        patient_login = self._register_and_login(username="pat4")
        pat_headers = {"Authorization": f"Bearer {patient_login['access_token']}"}
        sub = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Dana Patient",
                "contact_info": "dana@example.com",
                "symptom_text": "Experiencing a mild sore throat and runny nose for 2 days.",
            },
            headers=pat_headers,
        )
        appt_id = sub.json()["appointment_details"]["_id"]

        staff_token = main_module.create_access_token({"sub": "doctor_bob", "role": "staff"})
        self.fake_db.users.docs.append({"username": "doctor_bob", "role": "staff", "hashed_password": "x"})
        staff_headers = {"Authorization": f"Bearer {staff_token}"}

        ov = self.client.patch(
            f"/override-priority/{appt_id}",
            json={"new_priority": "Urgent", "reason": "Patient reported worsening fever by phone"},
            headers=staff_headers,
        )
        self.assertEqual(ov.status_code, 200)
        self.assertEqual(len(self.fake_db.audit_logs.docs), 1)
        log = self.fake_db.audit_logs.docs[0]
        self.assertEqual(log["previous_priority"], "Routine")
        self.assertEqual(log["new_priority"], "Urgent")
        self.assertEqual(log["reason"], "Patient reported worsening fever by phone")
        self.assertEqual(log["staff_username"], "doctor_bob")

    def test_calendar_manager_business_hours_and_rounding(self):
        dt_early = datetime(2026, 11, 20, 7, 14)
        self.assertEqual(main_module.CalendarManager._enforce_business_hours(dt_early).hour, 9)
        dt_late = datetime(2026, 11, 20, 17, 5)
        shifted = main_module.CalendarManager._enforce_business_hours(dt_late)
        self.assertEqual(shifted.day, 21)
        self.assertEqual(shifted.hour, 9)
        rounded = main_module.CalendarManager._round_to_slot(datetime(2026, 11, 20, 10, 16))
        self.assertEqual((rounded.hour, rounded.minute), (10, 30))

    def test_calendar_manager_malaysia_timezone_and_deterministic_slots(self):
        from datetime import timezone, timedelta
        # 1. Clinic timezone is explicitly UTC+8 (Malaysia Time)
        self.assertEqual(main_module.CLINIC_TZ, timezone(timedelta(hours=8)))

        # 2. 01:30 UTC is exactly 09:30 AM in Malaysia Time (UTC+8)
        dt_utc = datetime(2026, 11, 23, 1, 30, tzinfo=timezone.utc)
        dt_myt = main_module.CalendarManager.ensure_clinic_tz(dt_utc)
        self.assertEqual(dt_myt.hour, 9)
        self.assertEqual(dt_myt.minute, 30)

        # 3. ISO string parsing with UTC Z
        iso_str = "2026-11-23T01:30:00Z"
        from_iso = main_module.CalendarManager.ensure_clinic_tz(iso_str)
        self.assertEqual((from_iso.hour, from_iso.minute), (9, 30))

        # 4. Enforce business hours in MYT: 17:00 rolls over to next day 09:00
        closing_dt = datetime(2026, 11, 23, 17, 0, tzinfo=main_module.CLINIC_TZ)
        next_day_slot = main_module.CalendarManager._enforce_business_hours(closing_dt)
        self.assertEqual(next_day_slot.day, 24)
        self.assertEqual(next_day_slot.hour, 9)
        self.assertEqual(next_day_slot.minute, 0)

        # 5. Verify /submit-symptoms generates clinic_date and clinic_slot in details
        patient_login = self._register_and_login(username="pat_myt")
        headers = {"Authorization": f"Bearer {patient_login['access_token']}"}
        r = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Tashfiq Malaysia Patient",
                "contact_info": "tashfiq@example.com",
                "symptom_text": "Need routine medication refill for seasonal pollen allergy symptoms.",
            },
            headers=headers,
        )
        self.assertEqual(r.status_code, 200)
        details = r.json()["appointment_details"]
        self.assertIn("clinic_date", details)
        self.assertIn("clinic_slot", details)
        self.assertRegex(details["clinic_date"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertRegex(details["clinic_slot"], r"^\d{2}:\d{2}$")


if __name__ == "__main__":
    unittest.main(verbosity=2)
