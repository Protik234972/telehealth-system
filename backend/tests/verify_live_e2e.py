import asyncio
import time
import httpx
import websockets
import json

BASE_URL = "https://telehealth-system.onrender.com"
WS_URL = "wss://telehealth-system.onrender.com/ws"

async def run_live_verification():
    results = {}
    print("==================================================")
    print("STARTING LIVE E2E VERIFICATION ON RENDER + ATLAS")
    print(f"Base URL: {BASE_URL}")
    print(f"WS URL:   {WS_URL}")
    print("==================================================\n")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Test Admin Login
        print("[1] Testing Admin Authentication...")
        admin_res = await client.post("/login", data={"username": "admin", "password": "password123"})
        if admin_res.status_code == 200:
            admin_token = admin_res.json()["access_token"]
            results["admin_login"] = "PASS"
            print("  ✓ Admin login successful! Token received.")
        else:
            results["admin_login"] = f"FAIL ({admin_res.status_code}): {admin_res.text}"
            print(f"  ✗ Admin login failed: {admin_res.text}")
            return results

        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Test Doctor Login
        print("\n[2] Testing Doctor Authentication...")
        doctor_res = await client.post("/login", data={"username": "doctor_bob", "password": "password123"})
        if doctor_res.status_code == 200:
            doctor_token = doctor_res.json()["access_token"]
            results["doctor_login"] = "PASS"
            print("  ✓ Doctor login successful! Token received.")
        else:
            results["doctor_login"] = f"FAIL ({doctor_res.status_code}): {doctor_res.text}"
            print(f"  ✗ Doctor login failed: {doctor_res.text}")

        doctor_headers = {"Authorization": f"Bearer {doctor_token}"}

        # 3. Test Patient Registration & Login
        print("\n[3] Testing Patient Portal Flow (Registration + Login)...")
        ts = int(time.time())
        patient_username = f"e2e_pat_{ts}"
        patient_email = f"e2e_{ts}@example.com"
        reg_res = await client.post("/register", json={
            "username": patient_username,
            "password": "Password123!",
            "email": patient_email,
            "mobile": "+1234567890",
            "role": "patient"
        })
        if reg_res.status_code == 200:
            print(f"  ✓ Patient {patient_username} registered successfully.")
            results["patient_register"] = "PASS"
        else:
            print(f"  ✗ Patient registration failed: {reg_res.text}")
            results["patient_register"] = f"FAIL: {reg_res.text}"

        pat_login_res = await client.post("/login", data={"username": patient_username, "password": "Password123!"})
        if pat_login_res.status_code == 200:
            patient_token = pat_login_res.json()["access_token"]
            results["patient_login"] = "PASS"
            print("  ✓ Patient login successful!")
        else:
            results["patient_login"] = f"FAIL: {pat_login_res.text}"
            return results

        patient_headers = {"Authorization": f"Bearer {patient_token}"}

        # 4. Test WebSocket Real-time Connectivity
        print("\n[4] Testing WebSocket Real-time Connectivity...")
        ws_connected = False
        try:
            ws = await asyncio.wait_for(websockets.connect(WS_URL), timeout=10.0)
            ws_connected = True
            print("  ✓ WebSocket connected successfully to cluster!")
            results["websocket_connection"] = "PASS"
        except Exception as e:
            print(f"  ✗ WebSocket connection failed: {e}")
            results["websocket_connection"] = f"FAIL: {e}"
            ws = None

        # 5. Test Patient Symptom Submission (Routine)
        print("\n[5] Testing Patient Symptom Submission (Routine)...")
        routine_sub = await client.post("/submit-symptoms", json={
            "patient_name": f"Patient Routine {ts}",
            "contact_info": patient_email,
            "symptom_text": "[Vitals: Pain 2/10 | Duration: > 1 Week] Routine blood pressure medication refill prescription follow-up"
        }, headers=patient_headers)
        if routine_sub.status_code == 200:
            routine_data = routine_sub.json()
            urgency = routine_data.get("urgency")
            routine_appt_id = routine_data["appointment_details"]["_id"]
            scheduled_time = routine_data["appointment_details"]["scheduled_time"]
            print(f"  ✓ Routine submitted. Urgency: {urgency}, Slot: {scheduled_time}")
            results["routine_submission"] = f"PASS (Urgency: {urgency})"
        else:
            print(f"  ✗ Routine submission failed: {routine_sub.text}")
            results["routine_submission"] = f"FAIL: {routine_sub.text}"
            routine_appt_id = None

        # Check if WebSocket received update broadcast
        if ws_connected and ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"  ✓ WS received live broadcast event: '{msg}'")
                results["websocket_broadcast"] = f"PASS (Event: {msg})"
            except Exception as e:
                print(f"  ⚠ WS recv timeout or error: {e}")
                results["websocket_broadcast"] = f"WARN: {e}"

        # 6. Test Patient Symptom Submission (Emergency)
        print("\n[6] Testing Patient Symptom Submission (Emergency Preemption)...")
        emerg_sub = await client.post("/submit-symptoms", json={
            "patient_name": f"Patient Emergency {ts}",
            "contact_info": patient_email,
            "symptom_text": "[Vitals: Pain 9/10 | Duration: < 2 Hours | Fever reported] Crushing acute chest pain, radiating down left arm, shortness of breath and sweating"
        }, headers=patient_headers)
        if emerg_sub.status_code == 200:
            emerg_data = emerg_sub.json()
            urgency = emerg_data.get("urgency")
            emerg_appt_id = emerg_data["appointment_details"]["_id"]
            scheduled_time = emerg_data["appointment_details"]["scheduled_time"]
            print(f"  ✓ Emergency submitted. Urgency: {urgency}, Slot: {scheduled_time}")
            results["emergency_submission"] = f"PASS (Urgency: {urgency})"
        else:
            print(f"  ✗ Emergency submission failed: {emerg_sub.text}")
            results["emergency_submission"] = f"FAIL: {emerg_sub.text}"
            emerg_appt_id = None

        if ws_connected and ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"  ✓ WS received live broadcast event: '{msg}'")
                results["websocket_emergency_broadcast"] = f"PASS (Event: {msg})"
            except Exception as e:
                print(f"  ⚠ WS recv timeout or error: {e}")
            await ws.close()

        # 7. Test Admin Coordinator Queue Fetch
        print("\n[7] Testing Admin Coordinator Triage Queue Retrieval...")
        queue_res = await client.get("/get-queue", headers=admin_headers)
        if queue_res.status_code == 200:
            queue = queue_res.json().get("queue", [])
            print(f"  ✓ Triage queue retrieved. Total items: {len(queue)}")
            results["admin_queue_fetch"] = f"PASS (Items: {len(queue)})"
        else:
            print(f"  ✗ Queue fetch failed: {queue_res.text}")
            results["admin_queue_fetch"] = f"FAIL: {queue_res.text}"

        # 8. Test Doctor Assignment
        if routine_appt_id:
            print("\n[8] Testing Doctor Assignment by Coordinator...")
            assign_res = await client.patch(
                f"/update-status/{routine_appt_id}",
                json={"status": "Assigned to Doctor", "assigned_doctor": "doctor_bob"},
                headers=admin_headers
            )
            if assign_res.status_code == 200:
                print(f"  ✓ Appointment {routine_appt_id} successfully assigned to doctor_bob.")
                results["doctor_assignment"] = "PASS"
            else:
                print(f"  ✗ Doctor assignment failed: {assign_res.text}")
                results["doctor_assignment"] = f"FAIL: {assign_res.text}"

        # 9. Test Priority Override & Cascading Row Shifting
        if routine_appt_id:
            print("\n[9] Testing Priority Override & Priority-Cascaded Slot Allocation...")
            override_res = await client.patch(
                f"/override-priority/{routine_appt_id}",
                json={"new_priority": "Emergency", "reason": "Patient reported acute symptom escalation on call"},
                headers=admin_headers
            )
            if override_res.status_code == 200:
                data = override_res.json()
                new_time = data.get("new_time")
                print(f"  ✓ Priority overridden to Emergency! New allocated slot: {new_time}")
                results["priority_override_cascading"] = f"PASS (New slot: {new_time})"
            else:
                print(f"  ✗ Priority override failed: {override_res.text}")
                results["priority_override_cascading"] = f"FAIL: {override_res.text}"

        # 10. Test Audit Logs Retrieval
        print("\n[10] Testing Audit Logs Retrieval...")
        audit_res = await client.get("/audit-logs", headers=admin_headers)
        if audit_res.status_code == 200:
            logs = audit_res.json().get("logs", [])
            print(f"  ✓ Audit logs retrieved. Count: {len(logs)}")
            if logs:
                latest = logs[0]
                print(f"    Latest Log: Action={latest.get('action')}, PerformedBy={latest.get('performed_by')}, Old={latest.get('old_priority')} -> New={latest.get('new_priority')}")
            results["audit_logs"] = f"PASS (Total logs: {len(logs)})"
        else:
            print(f"  ✗ Audit logs failed: {audit_res.text}")
            results["audit_logs"] = f"FAIL: {audit_res.text}"

        # 11. Test Preemption Log Retrieval
        print("\n[11] Testing Preemption Log Retrieval...")
        preempt_res = await client.get("/preemption-log", headers=admin_headers)
        if preempt_res.status_code == 200:
            p_logs = preempt_res.json().get("events", [])
            print(f"  ✓ Preemption logs retrieved. Events: {len(p_logs)}")
            results["preemption_log"] = f"PASS (Events: {len(p_logs)})"
        else:
            print(f"  ✗ Preemption log failed: {preempt_res.text}")
            results["preemption_log"] = f"FAIL: {preempt_res.text}"

        # 12. Test Doctor Clinical Workspace
        print("\n[12] Testing Doctor Clinical Workspace Flow...")
        doc_queue_res = await client.get("/get-queue", headers=doctor_headers)
        if doc_queue_res.status_code == 200:
            doc_queue = doc_queue_res.json().get("queue", [])
            my_consultations = [a for a in doc_queue if a.get("assigned_to") == "doctor_bob"]
            print(f"  ✓ Doctor queue fetched. Total caseload for doctor_bob: {len(my_consultations)}")
            results["doctor_my_consultations"] = f"PASS ({len(my_consultations)} assigned)"
        else:
            print(f"  ✗ Doctor queue failed: {doc_queue_res.text}")
            results["doctor_my_consultations"] = f"FAIL: {doc_queue_res.text}"

        # 13. Test Doctor Consultation Discharge Workflow
        if routine_appt_id:
            print("\n[13] Testing Doctor Discharge Workflow...")
            discharge_res = await client.patch(
                f"/update-status/{routine_appt_id}",
                json={"status": "Resolved"},
                headers=doctor_headers
            )
            if discharge_res.status_code == 200:
                print(f"  ✓ Appointment {routine_appt_id} resolved/discharged by doctor.")
                results["doctor_discharge"] = "PASS"
            else:
                print(f"  ✗ Doctor discharge failed: {discharge_res.text}")
                results["doctor_discharge"] = f"FAIL: {discharge_res.text}"

        # 14. Test Analytics Endpoint
        print("\n[14] Testing Admin Analytics Intelligence Endpoint...")
        analytics_res = await client.get("/analytics", headers=admin_headers)
        if analytics_res.status_code == 200:
            adata = analytics_res.json()
            print("  ✓ Analytics fetched successfully:", adata)
            results["analytics_endpoint"] = "PASS"
        else:
            print(f"  ✗ Analytics failed: {analytics_res.text}")
            results["analytics_endpoint"] = f"FAIL: {analytics_res.text}"

    print("\n==================================================")
    print("LIVE E2E TEST SUMMARY RESULTS:")
    for k, v in results.items():
        print(f"  - {k}: {v}")
    print("==================================================")
    return results

if __name__ == "__main__":
    asyncio.run(run_live_verification())
