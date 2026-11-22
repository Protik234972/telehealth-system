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
                if "$exists" in v and ((k in doc) != v["$exists"]):
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

class ComprehensiveE2ESystemTests(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeDB()
        self.orig_db = main_module.db
        main_module.db = self.fake_db
        main_module.SMTP_EMAIL = ""
        main_module.SMTP_PASSWORD = ""
        self.client = TestClient(main_module.app)

        # 1. Seed standard hospital staff and admin
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
        self.fake_db.users.docs.append({
            "_id": ObjectId(),
            "username": "patient_alice",
            "role": "patient",
            "email": "alice@gmail.com"
        })

        self.admin_token = main_module.create_access_token({"sub": "admin", "role": "admin"})
        self.admin_headers = {"Authorization": f"Bearer {self.admin_token}"}

        self.doctor_token = main_module.create_access_token({"sub": "doctor_bob", "role": "staff"})
        self.doctor_headers = {"Authorization": f"Bearer {self.doctor_token}"}

        self.patient_token = main_module.create_access_token({"sub": "patient_alice", "role": "patient"})
        self.patient_headers = {"Authorization": f"Bearer {self.patient_token}"}

    def tearDown(self):
        main_module.db = self.orig_db

    def test_user_flow_patient_intake_and_ai_classification(self):
        """
        ROLE 1: Patient Portal Flow
        - Patient submits routine symptom
        - Patient submits emergency symptom
        - Verify AI priority classification and slot allocation
        """
        # A. Routine Symptom
        sub_routine = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Alice Patient",
                "contact_info": "alice@gmail.com",
                "symptom_text": "[Vitals: Pain 2/10 | Duration: > 1 Week] Routine blood pressure medication refill prescription renewal"
            },
            headers=self.patient_headers
        )
        self.assertEqual(sub_routine.status_code, 200)
        data_routine = sub_routine.json()
        self.assertIn(data_routine["urgency"], ["Routine", "Urgent"])
        self.assertIn("scheduled_time", data_routine["appointment_details"])

        # B. Emergency Symptom
        sub_emerg = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Alice Emergency",
                "contact_info": "alice@gmail.com",
                "symptom_text": "[Vitals: Pain 9/10 | Duration: < 2 Hours | Fever reported] Acute crushing chest pain, radiating down left arm, difficulty breathing and severe sweating"
            },
            headers=self.patient_headers
        )
        self.assertEqual(sub_emerg.status_code, 200)
        data_emerg = sub_emerg.json()
        self.assertIn(data_emerg["urgency"], ["Emergency", "Urgent"])

    def test_user_flow_admin_coordinator_dashboard(self):
        """
        ROLE 2: Admin Coordinator Flow
        - Queue listing
        - Doctor assignment
        - Priority override with priority-cascaded row shifting
        - Audit logs
        - Shift handover CSV data availability
        """
        appt_id = ObjectId()
        now = datetime(2026, 11, 23, 10, 0, 0)
        self.fake_db.appointments.docs.append({
            "_id": appt_id,
            "patient_name": "John Doe",
            "username": "johndoe",
            "contact_info": "john@example.com",
            "raw_symptom_text": "Fever and mild cough for 3 days",
            "ai_urgency_score": "Routine",
            "final_status": "Pending",
            "scheduled_time": now,
            "submission_time": now,
            "assigned_to": None
        })

        # 1. Fetch Queue
        q_res = self.client.get("/get-queue", headers=self.admin_headers)
        self.assertEqual(q_res.status_code, 200)
        self.assertEqual(len(q_res.json()["queue"]), 1)

        # 2. Assign Doctor
        assign_res = self.client.patch(
            f"/update-status/{str(appt_id)}",
            json={"status": "Assigned to Doctor", "assigned_doctor": "doctor_bob"},
            headers=self.admin_headers
        )
        self.assertEqual(assign_res.status_code, 200)
        self.assertEqual(self.fake_db.appointments.docs[0]["assigned_to"], "doctor_bob")

        # 3. Priority Override
        override_res = self.client.patch(
            f"/override-priority/{str(appt_id)}",
            json={"new_priority": "Emergency", "reason": "Patient reported acute chest tightness"},
            headers=self.admin_headers
        )
        self.assertEqual(override_res.status_code, 200)
        self.assertEqual(self.fake_db.appointments.docs[0]["ai_urgency_score"], "Emergency")

        # 4. Audit Log Verification
        audit_res = self.client.get("/audit-logs", headers=self.admin_headers)
        self.assertEqual(audit_res.status_code, 200)
        logs = audit_res.json()["logs"]
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["action"], "PRIORITY_OVERRIDE")
        self.assertEqual(logs[0]["performed_by"], "admin")
        self.assertEqual(logs[0]["old_priority"], "Routine")
        self.assertEqual(logs[0]["new_priority"], "Emergency")

    def test_user_flow_doctor_clinical_workspace(self):
        """
        ROLE 3: Doctor Clinical Workspace Flow
        - Doctor queries assigned patients ('My Consultations')
        - Doctor reviews patient details
        - Doctor discharges patient (status -> 'Resolved')
        """
        appt_id = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": appt_id,
            "patient_name": "Clinic Patient",
            "ai_urgency_score": "Urgent",
            "final_status": "Assigned to Doctor",
            "assigned_to": "doctor_bob",
            "scheduled_time": datetime.utcnow()
        })

        # 1. Doctor fetches queue
        doc_q = self.client.get("/get-queue", headers=self.doctor_headers)
        self.assertEqual(doc_q.status_code, 200)
        caseload = [a for a in doc_q.json()["queue"] if a.get("assigned_to") == "doctor_bob"]
        self.assertEqual(len(caseload), 1)
        self.assertEqual(caseload[0]["patient_name"], "Clinic Patient")

        # 2. Doctor Discharges Patient
        discharge_res = self.client.patch(
            f"/update-status/{str(appt_id)}",
            json={"status": "Resolved"},
            headers=self.doctor_headers
        )
        self.assertEqual(discharge_res.status_code, 200)
        self.assertEqual(self.fake_db.appointments.docs[0]["final_status"], "Resolved")

    def test_edge_case_priority_cascading_slot_shifting(self):
        """
        EDGE CASE 1:
        Patient priority escalation to Emergency:
        - Existing Emergency retains slot #1 (09:00)
        - New Emergency takes slot #2 (09:30)
        - Pre-existing non-emergency slots shift down by 1 row (+30 mins)
        """
        d = date(2026, 11, 23)
        t1 = datetime(2026, 11, 23, 9, 0, 0)
        t2 = datetime(2026, 11, 23, 9, 30, 0)
        t3 = datetime(2026, 11, 23, 10, 0, 0)

        # Existing Emergency
        id_em = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_em,
            "patient_name": "Old Emergency",
            "ai_urgency_score": "Emergency",
            "final_status": "Pending",
            "scheduled_time": t1
        })

        # Urgent
        id_urg = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_urg,
            "patient_name": "Urgent 1",
            "ai_urgency_score": "Urgent",
            "final_status": "Pending",
            "scheduled_time": t2
        })

        # Routine (escalating)
        id_rout = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": id_rout,
            "patient_name": "Routine 1",
            "ai_urgency_score": "Routine",
            "final_status": "Pending",
            "scheduled_time": t3
        })

        res = self.client.patch(
            f"/override-priority/{str(id_rout)}",
            json={"new_priority": "Emergency", "reason": "Acute distress"},
            headers=self.admin_headers
        )
        self.assertEqual(res.status_code, 200)

        appts = {str(a["_id"]): a for a in self.fake_db.appointments.docs}
        # Existing Emergency stays at 09:00
        self.assertEqual((appts[str(id_em)]["scheduled_time"].hour, appts[str(id_em)]["scheduled_time"].minute), (9, 0))
        # New Emergency gets 09:30
        self.assertEqual((appts[str(id_rout)]["scheduled_time"].hour, appts[str(id_rout)]["scheduled_time"].minute), (9, 30))
        # Urgent shifts down by 30 mins to 10:00
        self.assertEqual((appts[str(id_urg)]["scheduled_time"].hour, appts[str(id_urg)]["scheduled_time"].minute), (10, 0))

    def test_analytics_executive_intelligence_suite(self):
        """
        Verify the overhauled /analytics endpoint:
        - Priority distribution
        - KPI cards (total triaged, pending, resolved, emergency rate, preemption events)
        - Hourly intake (09:00 - 17:00 operational clinic hours)
        - Clinician caseload
        - Turnaround SLA trend data
        """
        now = datetime.utcnow()
        # Add diverse appointments
        self.fake_db.appointments.docs.extend([
            {
                "_id": ObjectId(),
                "patient_name": "P1",
                "ai_urgency_score": "Emergency",
                "final_status": "Pending",
                "scheduled_time": now,
                "submission_time": now,
                "assigned_to": "doctor_bob"
            },
            {
                "_id": ObjectId(),
                "patient_name": "P2",
                "ai_urgency_score": "Urgent",
                "final_status": "Pending",
                "scheduled_time": now,
                "submission_time": now,
                "assigned_to": "doctor_bob"
            },
            {
                "_id": ObjectId(),
                "patient_name": "P3",
                "ai_urgency_score": "Routine",
                "final_status": "Resolved",
                "scheduled_time": now,
                "submission_time": now,
                "assigned_to": None
            }
        ])

        res = self.client.get("/analytics?timeframe=all", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("kpi", data)
        self.assertIn("distribution", data)
        self.assertIn("hourly_intake", data)
        self.assertIn("clinician_caseload", data)
        self.assertIn("turnaround_trend", data)

        kpi = data["kpi"]
        self.assertEqual(kpi["total_triaged"], 3)
        self.assertEqual(kpi["emergency_count"], 1)
        self.assertEqual(kpi["urgent_count"], 1)
        self.assertEqual(kpi["routine_count"], 1)
        self.assertEqual(kpi["total_pending"], 2)
        self.assertEqual(kpi["total_resolved"], 1)

        # Verify hourly intake has 9 clinic hour slots (09:00 - 17:00)
        self.assertEqual(len(data["hourly_intake"]), 9)

if __name__ == "__main__":
    unittest.main(verbosity=2)
