# Phase 5: Enterprise Features & Polish

You are an expert full-stack developer. We have successfully built the core of an AI-Enabled Telehealth Appointment Triage System using FastAPI (Backend), React/Tailwind (Frontend), and MongoDB. The AI model is trained and successfully categorizes patients into Emergency, Urgent, or Routine priorities.

To elevate this project into an industry-level portfolio piece, we need to implement the following features. Please read through the list and ask me which one I would like to start with:

## 1. Security & Authentication
* **Staff JWT Login:** Build a secure login page for the Coordinator Dashboard. The backend should issue a JWT (JSON Web Token), and the frontend should use it to protect the `/dashboard` route.
* **Role-Based Access:** Differentiate between "Admin" and "Doctor" views.

## 2. Advanced Dashboard Interactions (Actionable UI)
* **Action Buttons:** Add buttons to the dashboard queue allowing staff to update patient status: `Assign to Doctor`, `Mark as Addressed`, or `Dismiss`.
* **Patient Detail Slide-out:** When a staff member clicks a patient row, slide out a detailed panel showing their full medical intake history and the exact timestamp of submission.
* **Search & Filters:** Add a search bar to find specific patients by name, and dropdown filters (e.g., "Show Emergencies Only" or "Show Pending Only").

## 3. Analytics & Data Visualization
* **Admin Analytics Page:** Create a third React view using a charting library (like Recharts).
* **Key Metrics:** Display live charts for "Average Wait Times", "Daily Triage Volumes", and a pie chart of "Emergency vs Routine" ratios.

## 4. Enhanced AI Transparency
* **Symptom Highlighting:** Modify the NLP pipeline to extract the highest-weighted keywords (e.g., "chest pain") and send them to the frontend so the React dashboard can visually highlight the specific words that triggered the "Emergency" status.

## 5. UI/UX Polish
* **Dark Mode:** Implement a global Dark Mode toggle using Tailwind's `dark:` classes.
* **Hospital Landing Page:** Create a welcoming, professional homepage that explains the hospital's AI triage process before routing the patient to the actual portal.
* **WebSockets (Real-time):** Replace the 5-second polling interval with FastAPI WebSockets for true, instant real-time UI updates when a new patient submits a form.

---
**Instructions for the AI:** 
Acknowledge this prompt, review our current codebase structure, and ask me which of these 5 pillars we should begin implementing first.
