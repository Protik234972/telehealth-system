import unittest
from datetime import datetime
from bson import ObjectId
from fastapi.testclient import TestClient

import backend.main as main_module
from backend.tests.test_full_system_e2e import FakeDB

class StreamlinedFlowsVerificationTests(unittest.TestCase):
    def setUp(self):
        self.fake_db = FakeDB()
        self.orig_db = main_module.db
        main_module.db = self.fake_db
        main_module.SMTP_EMAIL = ""
        main_module.SMTP_PASSWORD = ""
        self.client = TestClient(main_module.app)

        # Seed staff and patient
        self.fake_db.users.docs.append({
            "_id": ObjectId(),
            "username": "doctor_bob",
            "role": "staff",
            "email": "doctor_bob@hospital.org"
        })
        self.fake_db.users.docs.append({
            "_id": ObjectId(),
            "username": "patient_jane",
            "role": "patient",
            "email": "jane@example.com"
        })

        self.patient_token = main_module.create_access_token({"sub": "patient_jane", "role": "patient"})
        self.patient_headers = {"Authorization": f"Bearer {self.patient_token}"}

        self.doctor_token = main_module.create_access_token({"sub": "doctor_bob", "role": "staff"})
        self.doctor_headers = {"Authorization": f"Bearer {self.doctor_token}"}

    def tearDown(self):
        main_module.db = self.orig_db

    def test_patient_symptom_submission_with_checkboxes(self):
        """
        Verify symptom intake with structured checkbox payload from PatientPortal.jsx:
        Format: [Reported Symptoms: Chest Pain / Pressure, Shortness of Breath | Duration: < 2 Hours]
        """
        # 1. Submission with checkboxes only
        res1 = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Jane Doe",
                "contact_info": "jane@example.com",
                "symptom_text": "[Reported Symptoms: Chest Pain / Pressure, Shortness of Breath | Duration: < 2 Hours] Patient presents with Chest Pain / Pressure, Shortness of Breath experienced for < 2 Hours."
            },
            headers=self.patient_headers
        )
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertIn("appointment_details", data1)
        self.assertEqual(data1["appointment_details"]["ai_urgency_score"], "Emergency")

        # 2. Submission with checkboxes + freeform clinical narrative
        res2 = self.client.post(
            "/submit-symptoms",
            json={
                "patient_name": "Jane Routine",
                "contact_info": "jane@example.com",
                "symptom_text": "[Reported Symptoms: Cough / Sore Throat | Duration: 3–7 Days] Mild throat irritation, need regular prescription renewal for routine medication."
            },
            headers=self.patient_headers
        )
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertIn("appointment_details", data2)
        self.assertIn(data2["appointment_details"]["ai_urgency_score"], ["Routine", "Urgent"])

    def test_doctor_manual_vitals_prescriptions_labs_discharge(self):
        """
        Verify doctor clinical encounter workflow:
        1. Consultation assigned to doctor_bob
        2. Doctor documents manual vitals, clinical note, prescriptions, and lab orders
        3. Doctor resolves/discharges consultation
        4. Complete summary stored in EHR and status transitions to Resolved
        """
        appt_id = ObjectId()
        self.fake_db.appointments.docs.append({
            "_id": appt_id,
            "patient_name": "Mark Patient",
            "username": "patient_mark",
            "ai_urgency_score": "Urgent",
            "final_status": "Assigned to Doctor",
            "assigned_to": "doctor_bob",
            "scheduled_time": datetime.utcnow()
        })

        # Structured EHR compilation from Dashboard.jsx
        clinical_documentation = (
            "[CLINICAL CONSULTATION NOTE]\n"
            "Attending Clinician: Dr. Bob\n"
            "Patient is alert, oriented x3. Lung sounds clear bilaterally.\n\n"
            "[MANUAL VITALS RECORDED]\n"
            "BP: 124/82 mmHg | HR: 76 bpm | SpO2: 99% | Temp: 98.4°F | RR: 16 breaths/min\n\n"
            "[PRESCRIPTIONS]\n"
            "• Amoxicillin 500mg PO TID x 7 days\n"
            "• Paracetamol 500mg PO Q4-6H PRN pain/fever (Max 4g/24h)\n\n"
            "[TESTS & LABS ORDERED]\n"
            "• Complete Blood Count (CBC)\n"
            "• 12-Lead Electrocardiogram (ECG)"
        )

        # Doctor Discharges Patient via PATCH /update-status/{id}
        discharge_res = self.client.patch(
            f"/update-status/{str(appt_id)}",
            json={
                "status": "Resolved",
                "doctor_notes": clinical_documentation
            },
            headers=self.doctor_headers
        )
        self.assertEqual(discharge_res.status_code, 200)

        # Verify DB document
        updated = self.fake_db.appointments.docs[0]
        self.assertEqual(updated["final_status"], "Resolved")
        self.assertIn("[MANUAL VITALS RECORDED]", updated["doctor_notes"])
        self.assertIn("BP: 124/82 mmHg", updated["doctor_notes"])
        self.assertIn("[PRESCRIPTIONS]", updated["doctor_notes"])
        self.assertIn("Amoxicillin 500mg", updated["doctor_notes"])
        self.assertIn("[TESTS & LABS ORDERED]", updated["doctor_notes"])
        self.assertIn("12-Lead Electrocardiogram (ECG)", updated["doctor_notes"])

if __name__ == "__main__":
    unittest.main(verbosity=2)
