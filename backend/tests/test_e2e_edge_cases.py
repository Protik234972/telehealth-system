import unittest
import copy
from datetime import datetime, date, timedelta
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

    async def to_list(self, length=1000):
        return [copy.deepcopy(d) for d in self._docs[:length]]

class FakeCollection:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        if not query:
            return True
        for k, v in query.items():
            if k == "$or":
                if not any(FakeCollection._matches(doc, cond) for cond in v):
                    return False
                continue
            val = doc.get(k)
            if isinstance(v, dict):
                if "$in" in v and val not in v["$in"]:
                    return False
                if "$ne" in v and val == v["$ne"]:
                    return False
                if "$gte" in v and (val is None or val < v["$gte"]):
                    return False
                if "$lte" in v and (val is None or val > v["$lte"]):
                    return False
                if "$lt" in v and (val is None or val >= v["$lt"]):
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

    async def update_many(self, query, update):
        count = 0
        for d in self.docs:
            if self._matches(d, query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        d[k] = copy.deepcopy(v)
                count += 1
        return _UpdateResult(count)

    async def count_documents(self, query=None):
        return sum(1 for d in self.docs if self._matches(d, query or {}))

class FakeDB:
    def __init__(self):
        self.users = FakeCollection()
        self.appointments = FakeCollection()
        self.preemption_log = FakeCollection()
        self.audit_logs = FakeCollection()

class EdgeCaseVerificationTests(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeDB()
        self.orig_db = main_module.db
        main_module.db = self.fake_db
        main_module.SMTP_EMAIL = ""
        main_module.SMTP_PASSWORD = ""
        self.client = TestClient(main_module.app)

        # Create admin and doctor users
        self.fake_db.users.docs.append({
            "_id": ObjectId(),
            "username": "admin",
            "role": "admin",
            "email": "admin@hospital.org"
        })
        self.fake_db.users.docs.append({
            "_id": ObjectId(),
            "username": "doctor_bob",
            "role": "staff",
            "email": "doctor_bob@hospital.org"
        })

        self.admin_token = main_module.create_access_token({"sub": "admin", "role": "admin"})
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

        self.doctor_token = main_module.create_access_token({"sub": "doctor_bob", "role": "staff"})
        self.doctor_headers = {"Authorization": f"Bearer {self.doctor_token}"}

    def tearDown(self):
        main_module.db = self.orig_db

    def test_priority_cascading_emergency_shifts_slots_down(self):
        """
        EDGE CASE TEST:
        When a patient is changed to Emergency:
        - Existing emergencies stay first
        - New emergency gets the next slot
        - Subsequent slots shift down by 1 row (+30 mins)
        """
        today = date(2026, 11, 23)
        t900 = datetime(2026, 11, 23, 9, 0, 0)
        t930 = datetime(2026, 11, 23, 9, 30, 0)
        t1000 = datetime(2026, 11, 23, 10, 0, 0)
        t1030 = datetime(2026, 11, 23, 10, 30, 0)

        # Existing Emergency
        id_em1 = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_em1,
            "patient_name": "Emergency Patient 1",
            "ai_urgency_score": "Emergency",
            "final_status": "Pending",
            "scheduled_time": t900,
            "submission_time": t900
        })

        # Urgent Patient 1
        id_urg1 = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_urg1,
            "patient_name": "Urgent Patient 1",
            "ai_urgency_score": "Urgent",
            "final_status": "Pending",
            "scheduled_time": t930,
            "submission_time": t930
        })

        # Routine Patient 1 (to be escalated)
        id_rout1 = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_rout1,
            "patient_name": "Routine Patient 1 (Escalating)",
            "ai_urgency_score": "Routine",
            "final_status": "Pending",
            "scheduled_time": t1000,
            "submission_time": t1000
        })

        # Routine Patient 2
        id_rout2 = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_rout2,
            "patient_name": "Routine Patient 2",
            "ai_urgency_score": "Routine",
            "final_status": "Pending",
            "scheduled_time": t1030,
            "submission_time": t1030
        })

        # Perform Priority Override on Routine Patient 1 -> Emergency
        res = self.client.patch(
            f"/override-priority/{str(id_rout1)}",
            json={"new_priority": "Emergency", "reason": "Patient developed sudden severe dyspnea"},
            headers=self.admin_headers
        )
        self.assertEqual(res.status_code, 200)

        # Fetch updated appointments
        appts = {str(d["_id"]): d for d in self.fake_db.appointments.docs}

        # Verification 1: Existing Emergency Patient 1 stays first at 09:00
        self.assertEqual(appts[str(id_em1)]["scheduled_time"].hour, 9)
        self.assertEqual(appts[str(id_em1)]["scheduled_time"].minute, 0)

        # Verification 2: Newly escalated emergency (Routine 1) gets the next slot at 09:30
        self.assertEqual(appts[str(id_rout1)]["scheduled_time"].hour, 9)
        self.assertEqual(appts[str(id_rout1)]["scheduled_time"].minute, 30)
        self.assertEqual(appts[str(id_rout1)]["ai_urgency_score"], "Emergency")

        # Verification 3: Subsequent Urgent Patient 1 is shifted down by 1 row (+30 mins) to 10:00
        self.assertEqual(appts[str(id_urg1)]["scheduled_time"].hour, 10)
        self.assertEqual(appts[str(id_urg1)]["scheduled_time"].minute, 0)

        # Verification 4: Subsequent Routine Patient 2 is shifted down by 1 row (+30 mins) to 10:30
        self.assertEqual(appts[str(id_rout2)]["scheduled_time"].hour, 10)
        self.assertEqual(appts[str(id_rout2)]["scheduled_time"].minute, 30)

        # Verification 5: Clinical audit trail was written with exact actor and reason
        self.assertEqual(len(self.fake_db.audit_logs.docs), 1)
        audit = self.fake_db.audit_logs.docs[0]
        self.assertEqual(audit["action"], "PRIORITY_OVERRIDE")
        self.assertEqual(audit["performed_by"], "admin")
        self.assertEqual(audit["old_priority"], "Routine")
        self.assertEqual(audit["new_priority"], "Emergency")
        self.assertEqual(audit["reason"], "Patient developed sudden severe dyspnea")

    def test_doctor_assignment_and_discharge_workflow(self):
        """
        Verify that:
        1. Admin assigns patient to doctor_bob
        2. Doctor sees patient in caseload
        3. Doctor resolves/discharges patient
        4. Patient status transitions to Resolved
        """
        appt_id = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": appt_id,
            "patient_name": "Test Consult Patient",
            "ai_urgency_score": "Urgent",
            "final_status": "Pending",
            "assigned_to": None,
            "scheduled_time": datetime.utcnow()
        })

        # 1. Admin assigns to doctor_bob
        res_assign = self.client.patch(
            f"/update-status/{str(appt_id)}",
            json={"status": "Assigned to Doctor", "assigned_doctor": "doctor_bob"},
            headers=self.admin_headers
        )
        self.assertEqual(res_assign.status_code, 200)

        updated_appt = self.fake_db.appointments.docs[0]
        self.assertEqual(updated_appt["assigned_to"], "doctor_bob")
        self.assertEqual(updated_appt["final_status"], "Assigned to Doctor")

        # 2. Doctor discharges patient (status -> Resolved)
        res_discharge = self.client.patch(
            f"/update-status/{str(appt_id)}",
            json={"status": "Resolved"},
            headers=self.doctor_headers
        )
        self.assertEqual(res_discharge.status_code, 200)
        self.assertEqual(self.fake_db.appointments.docs[0]["final_status"], "Resolved")

    def test_shift_handover_csv_data_fields(self):
        """
        Verify all required fields exist for shift handover CSV export:
        Patient Name, Urgency, Status, Scheduled Time, Assigned Doctor, Symptoms
        """
        self.fake_db.appointments.docs.append({
            "_id": ObjectId(),
            "patient_name": "CSV Export Patient",
            "ai_urgency_score": "Routine",
            "final_status": "Assigned to Doctor",
            "assigned_to": "doctor_bob",
            "scheduled_time": datetime(2026, 11, 23, 11, 0, 0),
            "raw_symptom_text": "Follow-up test for blood pressure"
        })

        res = self.client.get("/get-queue", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        queue = res.json()["queue"]
        self.assertEqual(len(queue), 1)
        item = queue[0]
        self.assertIn("patient_name", item)
        self.assertIn("ai_urgency_score", item)
        self.assertIn("final_status", item)
        self.assertIn("scheduled_time", item)
        self.assertIn("assigned_to", item)
        self.assertIn("raw_symptom_text", item)

if __name__ == "__main__":
    unittest.main(verbosity=2)
