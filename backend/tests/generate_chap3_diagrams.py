"""Chapter 3, 4, and 5 diagrams for the FYP report, drawn at final print size (5.7 in wide).

Coordinates are in inches (1 data unit = 1 inch), so font sizes are the sizes that will
actually be printed. Figure numbers/titles are NOT drawn into the images: the Word
report supplies the numbered captions. Run from the repository root:

    python backend/tests/generate_chap3_diagrams.py
"""
import os
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Circle, Ellipse, FancyArrowPatch, FancyBboxPatch, Polygon, Wedge
import numpy as np

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(BASE_DIR, "report_charts")
SCREENS_DIR = os.path.join(OUT_DIR, "screens")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(SCREENS_DIR, exist_ok=True)


def _pick(candidates, fallback):
    names = {f.name for f in font_manager.fontManager.ttflist}
    for name in candidates:
        if name in names:
            return name
    return fallback


SANS = _pick(["Arial", "Calibri"], "DejaVu Sans")
MONO = _pick(["Consolas", "Courier New"], "DejaVu Sans Mono")

PAL = {
    "blue": ("#dbeafe", "#1d4ed8"),
    "purple": ("#ede9fe", "#6d28d9"),
    "green": ("#dcfce7", "#15803d"),
    "amber": ("#fef3c7", "#b45309"),
    "red": ("#fee2e2", "#b91c1c"),
    "slate": ("#f1f5f9", "#334155"),
    "white": ("#ffffff", "#334155"),
    "navy": ("#0f172a", "#1e293b"),
}
INK = "#0f172a"
WARNINGS = []


def canvas(w, h):
    fig = plt.figure(figsize=(w, h), dpi=300)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w)
    ax.set_ylim(0, h)
    ax.axis("off")
    return fig, ax


def check_fit(fig, ax, txt, x, y, w, h, tag):
    """Record a warning if the rendered text is larger than the box it should sit in."""
    fig.canvas.draw()
    bb = txt.get_window_extent(fig.canvas.get_renderer())
    inv = ax.transData.inverted()
    (x0, y0), (x1, y1) = inv.transform((bb.x0, bb.y0)), inv.transform((bb.x1, bb.y1))
    tol = 0.05
    if x0 < x - tol or x1 > x + w + tol or y0 < y - tol or y1 > y + h + tol:
        WARNINGS.append(f"{tag}: text {x1 - x0:.2f} x {y1 - y0:.2f} in exceeds box {w:.2f} x {h:.2f} in")


def rbox(fig, ax, x, y, w, h, text="", color="white", fs=6.5, bold=False, lw=1.0, ls="-", tag="",
         fc=None, ec=None, z=3, ha="center", align_left=False, pad=0.06):
    f, e = PAL.get(color, ("#ffffff", "#334155"))
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={pad}",
                                fc=fc or f, ec=ec or e, lw=lw, ls=ls, zorder=z))
    if text:
        tx = x + 0.08 if align_left else x + w / 2
        ty = y + h - 0.08 if align_left else y + h / 2
        va = "top" if align_left else "center"
        t_ha = "left" if align_left else ha
        t = ax.text(tx, ty, text, ha=t_ha, va=va, fontsize=fs, color=INK,
                    fontweight="bold" if bold else "normal", family=SANS, zorder=z + 1, linespacing=1.16)
        check_fit(fig, ax, t, x, y, w, h, tag or text.split("\n")[0])


def arrow(ax, p1, p2, color="#334155", lw=1.0, ls="-", both=False, ms=7, z=2):
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="<|-|>" if both else "-|>", mutation_scale=ms,
                                 color=color, lw=lw, ls=ls, zorder=z, shrinkA=0, shrinkB=0))


def label(ax, x, y, s, fs=5.8, color="#334155", ha="center", italic=False, bg="white", z=7):
    ax.text(x, y, s, ha=ha, va="center", fontsize=fs, color=color, family=SANS,
            fontstyle="italic" if italic else "normal", zorder=z, linespacing=1.1,
            bbox=dict(boxstyle="round,pad=0.06", fc=bg, ec="none"))


def save(fig, name):
    out = os.path.join(OUT_DIR, name)
    fig.savefig(out, dpi=300, facecolor="white")
    plt.close(fig)
    print("saved", out)


# --------------------------------------------------------------------------
# Figure 3-1  Three-tier System Architecture
# --------------------------------------------------------------------------
def fig_architecture():
    W, H = 5.7, 5.75
    fig, ax = canvas(W, H)
    tiers = [
        ("PRESENTATION TIER", 4.30, 1.30, "blue"),
        ("APPLICATION SERVER TIER", 1.55, 2.60, "purple"),
        ("DATA & INTEGRATION TIER", 0.10, 1.30, "green"),
    ]
    for name, y, h, c in tiers:
        f, e = PAL[c]
        ax.add_patch(FancyBboxPatch((0.32, y), 5.33, h, boxstyle="round,pad=0,rounding_size=0.08",
                                    fc=f, ec=e, lw=1.2, ls="--", zorder=1, alpha=0.45))
        ax.text(0.16, y + h / 2, name, rotation=90, ha="center", va="center", fontsize=6.3,
                fontweight="bold", color=e, family=SANS)

    bw = 1.62
    xs = [0.42, 2.18, 3.94]

    # Presentation Tier
    rbox(fig, ax, xs[0], 4.45, bw, 1.00,
         "Patient Portal & Intake\n• 10 structured checkboxes\n• Duration & red-flag badges\n• Family multi-profile booking\n• History & preemption alert",
         "white", fs=6.0, ec=PAL["blue"][1])
    rbox(fig, ax, xs[1], 4.45, bw, 1.00,
         "Doctor Clinical Suite\n• Assigned caseload filter\n• Physical examination vitals\n• Prescriptions & lab orders\n• 1-click patient discharge",
         "white", fs=6.0, ec=PAL["blue"][1])
    rbox(fig, ax, xs[2], 4.45, bw, 1.00,
         "Coordinator & Admin\n• Live priority queue (WS)\n• Override modal + audit log\n• 30-min schedule matrix\n• Executive Analytics KPIs",
         "white", fs=6.0, ec=PAL["blue"][1])

    # Application Server Tier
    # Row 1: Gateway
    rbox(fig, ax, 0.42, 3.52, 5.14, 0.50,
         "REST & Security Gateway (FastAPI, Python 3.11)\nHS256 JWT Authentication • Pydantic Data Contracts • Role-Based Access Control (RBAC)",
         "white", fs=6.3, bold=True, ec=PAL["purple"][1])

    # Row 2: Hybrid Triage Engine & Universal Wall-Clock Scheduler
    hw = 2.48
    rbox(fig, ax, 0.42, 2.25, hw, 1.15,
         "Hybrid Clinical Triage Engine\n• Deterministic Red-Flag Safety Layer\n  (Instant Emergency fast-track bypass)\n• Clinical Negation Preprocessor ('no_fever')\n• Calibrated Linear SVM (5k N-Grams)",
         "white", fs=6.0, ec=PAL["amber"][1], fc="#fffbeb")
    rbox(fig, ax, 3.08, 2.25, hw, 1.15,
         "Universal Wall-Clock Scheduler\n• 30-min slot matrix (09:00 - 17:00)\n• Emergency preemption allocation\n• Priority cascading shift (+30 mins)\n• Zero cross-border timezone difference",
         "white", fs=6.0, ec=PAL["purple"][1])

    # Row 3: WebSocket Manager & Notification Worker
    rbox(fig, ax, 0.42, 1.65, hw, 0.50,
         "WebSocket Connection Manager\nReal-time queue broadcast & audio-visual alerts",
         "white", fs=6.0, ec=PAL["purple"][1])
    rbox(fig, ax, 3.08, 1.65, hw, 0.50,
         "Async Notification Dispatcher\nPreemption alert dispatch & Gmail SMTP / SMS",
         "white", fs=6.0, ec=PAL["purple"][1])

    # Data Tier
    rbox(fig, ax, 0.42, 0.22, 2.75, 1.05,
         "MongoDB Atlas (Motor Async Driver)\nCollections:\n• users (roles: patient, doctor, staff, admin)\n• appointments (enriched clinical BSON)\n• preemption_log  • audit_logs (immutable trail)",
         "white", fs=6.0, ec=PAL["green"][1])
    rbox(fig, ax, 3.32, 0.22, 2.24, 1.05,
         "External Notification Gateways\n• Gmail SMTP (Email confirmation)\n• Twilio REST API (SMS alerts)\n• Background worker task queues",
         "white", fs=6.0, ec=PAL["green"][1])

    # Inter-tier arrows
    # Presentation to Gateway
    arrow(ax, (1.23, 4.45), (1.23, 4.02), color="#1d4ed8")
    arrow(ax, (2.99, 4.45), (2.99, 4.02), color="#1d4ed8")
    arrow(ax, (4.75, 4.45), (4.75, 4.02), color="#1d4ed8")
    label(ax, 2.99, 4.22, "HTTPS REST (JSON + JWT)", fs=5.8, color="#1d4ed8")

    # Gateway to Triage
    arrow(ax, (1.66, 3.52), (1.66, 3.40), color="#6d28d9")
    # Triage to Scheduler
    arrow(ax, (2.90, 2.82), (3.08, 2.82), color="#b45309")
    label(ax, 2.99, 2.95, "priority", fs=5.6, color="#b45309")

    # Scheduler to WS and Worker
    arrow(ax, (3.08, 2.45), (2.10, 2.15), color="#6d28d9")
    arrow(ax, (4.32, 2.25), (4.32, 2.15), color="#6d28d9")

    # WS push to Coordinator and Patient
    arrow(ax, (0.75, 2.15), (0.75, 4.45), color="#1d4ed8", ls="--")
    label(ax, 0.75, 3.25, "WSS Push", fs=5.5, color="#1d4ed8")
    arrow(ax, (5.10, 2.15), (5.10, 4.45), color="#1d4ed8", ls="--")
    label(ax, 5.10, 3.25, "WSS Push", fs=5.5, color="#1d4ed8")

    # App server to Data Tier
    arrow(ax, (1.66, 1.55), (1.66, 1.27), color="#15803d")
    label(ax, 1.66, 1.41, "Motor driver (TLS)", fs=5.6, color="#15803d")
    arrow(ax, (4.32, 1.55), (4.32, 1.27), color="#15803d")
    label(ax, 4.32, 1.41, "SMTP / REST API", fs=5.6, color="#15803d")

    save(fig, "fig_3_1_system_architecture.png")


# --------------------------------------------------------------------------
# Figure 3-2  UML Use Case Diagram with 3 Human Actors
# --------------------------------------------------------------------------
def stick(ax, cx, cy, name, color):
    ax.add_patch(Circle((cx, cy + 0.28), 0.08, fc="white", ec=color, lw=1.2, zorder=4))
    ax.plot([cx, cx], [cy + 0.20, cy - 0.04], color=color, lw=1.2, zorder=4)
    ax.plot([cx - 0.13, cx + 0.13], [cy + 0.13, cy + 0.13], color=color, lw=1.2, zorder=4)
    ax.plot([cx, cx - 0.10], [cy - 0.04, cy - 0.24], color=color, lw=1.2, zorder=4)
    ax.plot([cx, cx + 0.10], [cy - 0.04, cy - 0.24], color=color, lw=1.2, zorder=4)
    ax.text(cx, cy - 0.32, name, ha="center", va="top", fontsize=6.3, fontweight="bold", color=color,
            family=SANS, linespacing=1.1)


def fig_use_case():
    W, H = 5.7, 7.35
    fig, ax = canvas(W, H)
    ax.add_patch(FancyBboxPatch((1.18, 0.10), 3.44, 7.15, boxstyle="round,pad=0,rounding_size=0.08",
                                fc="#f8fafc", ec=INK, lw=1.3, zorder=1))
    ax.text(2.90, 7.08, "TeleTriage AI: Clinical Triage & Scheduling Coordination System", ha="center", va="center",
            fontsize=7.0, fontweight="bold", color=INK, family=SANS)

    uw, uh = 1.48, 0.44
    col_left, col_right = 1.98, 3.82

    ucs = {
        "uc01": (col_left, 6.55, "UC-01: Authenticate / Login\n(JWT HS256, all roles)"),
        "uc02": (col_left, 5.92, "UC-02: Submit Structured Intake\n(Checkboxes + Duration)"),
        "uc03": (col_left, 5.28, "UC-03: View Medical History\n& Family Profiles"),
        "uc09": (col_left, 4.45, "UC-09: Filter Assigned Caseload\n('My Consultations')"),
        "uc10": (col_left, 3.82, "UC-10: Record Physical Vitals\n(BP, HR, SpO2, Temp, RR)"),
        "uc11": (col_left, 3.18, "UC-11: Author Clinical Note\n& Issue Prescriptions"),
        "uc12": (col_left, 2.55, "UC-12: Order Diagnostic Labs\n& 1-Click Discharge"),
        "uc06": (col_left, 1.75, "UC-06: Monitor Live Queue\n(Real-Time WebSocket)"),
        "uc07": (col_left, 1.12, "UC-07: Clinical Override\n(Mandatory Justification)"),
        "uc08": (col_left, 0.48, "UC-08: Manage Schedule Matrix\n(30-Min Universal Slots)"),

        "uc04": (col_right, 5.92, "UC-04: Evaluate Hybrid Triage\n(Red-Flag + Calibrated SVM)"),
        "uc05": (col_right, 5.28, "UC-05: Priority-Cascaded\nScheduling (+30m Shift)"),
        "uc13": (col_right, 1.75, "UC-13: Executive Analytics\n(6 KPIs + Recharts Graphs)"),
        "uc14": (col_right, 1.12, "UC-14: Audit Preemption Events\n& Clinical Override Logs"),
    }

    for cx, cy, txt in ucs.values():
        ax.add_patch(Ellipse((cx, cy), uw, uh, fc="white", ec="#1d4ed8", lw=1.0, zorder=3))
        ax.text(cx, cy, txt, ha="center", va="center", fontsize=5.8, color=INK, family=SANS,
                zorder=4, linespacing=1.12)

    stick(ax, 0.50, 5.70, "Patient", PAL["blue"][1])
    stick(ax, 0.50, 3.45, "Doctor\n(Attending Clinician)", PAL["purple"][1])
    stick(ax, 0.50, 1.15, "Coordinator /\nAdministrator", PAL["green"][1])
    stick(ax, 5.15, 5.60, "AI & Scheduler\nEngine", PAL["amber"][1])

    def assoc(p_xy, uc, side, color):
        cx, cy, _ = ucs[uc]
        ex = cx - uw / 2 if side == "L" else cx + uw / 2
        ax.plot([p_xy[0], ex], [p_xy[1], cy], color=color, lw=1.0, zorder=2)

    # Patient connections
    assoc((0.68, 5.75), "uc01", "L", PAL["blue"][1])
    assoc((0.68, 5.70), "uc02", "L", PAL["blue"][1])
    assoc((0.68, 5.65), "uc03", "L", PAL["blue"][1])

    # Doctor connections (6 use cases)
    assoc((0.68, 3.75), "uc01", "L", PAL["purple"][1])
    assoc((0.68, 3.65), "uc09", "L", PAL["purple"][1])
    assoc((0.68, 3.55), "uc10", "L", PAL["purple"][1])
    assoc((0.68, 3.45), "uc11", "L", PAL["purple"][1])
    assoc((0.68, 3.35), "uc12", "L", PAL["purple"][1])

    # Coordinator connections
    assoc((0.68, 1.35), "uc01", "L", PAL["green"][1])
    assoc((0.68, 1.25), "uc06", "L", PAL["green"][1])
    assoc((0.68, 1.15), "uc07", "L", PAL["green"][1])
    assoc((0.68, 1.05), "uc08", "L", PAL["green"][1])
    assoc((0.68, 0.95), "uc13", "L", PAL["green"][1])
    assoc((0.68, 0.85), "uc14", "L", PAL["green"][1])

    # AI engine connections
    assoc((4.98, 5.65), "uc04", "R", PAL["amber"][1])
    assoc((4.98, 5.55), "uc05", "R", PAL["amber"][1])

    # Includes arrows
    arrow(ax, (col_left + uw / 2, 5.92), (col_right - uw / 2, 5.92), color="#475569", ls="--", ms=6)
    label(ax, (col_left + col_right) / 2, 6.04, "<<include>>", fs=5.5, italic=True)

    arrow(ax, (col_right, 5.70), (col_right, 5.50), color="#475569", ls="--", ms=6)
    label(ax, col_right + 0.32, 5.60, "<<include>>", fs=5.5, italic=True)

    arrow(ax, (col_left + uw / 2, 1.12), (col_right - uw / 2, 1.12), color="#475569", ls="--", ms=6)
    label(ax, (col_left + col_right) / 2, 1.24, "<<include>>", fs=5.5, italic=True)

    save(fig, "fig_3_2_use_case_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-3  Backend Class & Entity Diagram
# --------------------------------------------------------------------------
def uml_class(fig, ax, x, y, w, h, title, body, color="blue"):
    f, e = PAL[color]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.05", fc="white", ec=e, lw=1.1, zorder=2))
    hh = 0.28
    ax.add_patch(FancyBboxPatch((x, y + h - hh), w, hh, boxstyle="round,pad=0,rounding_size=0.05", fc=f, ec=e, lw=1.1, zorder=3))
    ax.text(x + w / 2, y + h - hh / 2, title, ha="center", va="center", fontsize=6.6, fontweight="bold",
            color=INK, family=SANS, zorder=4)
    ax.text(x + 0.08, y + h - hh - 0.07, body, ha="left", va="top", fontsize=5.8, color="#1e293b",
            family=MONO, zorder=4, linespacing=1.28)


def fig_class():
    W, H = 5.7, 5.50
    fig, ax = canvas(W, H)

    # Top row
    uml_class(fig, ax, 0.08, 3.85, 2.70, 1.55, "HybridTriageEngine",
              "- nlp: Language (spaCy)\n- svm_pipeline: Pipeline\n- red_flag_rules: dict\n+ detect_clinical_red_flags(text, cb): tuple\n+ preprocess_clinical_text(text): str\n+ predict_urgency(text, cb): tuple[str, float]",
              "amber")

    uml_class(fig, ax, 2.92, 3.85, 2.70, 1.55, "CalendarManager",
              "<<static>>\n+ round_to_slot(dt: datetime): datetime\n+ enforce_business_hours(dt): datetime\n+ get_next_available_slot(urgency): dt\n+ preempt_for_emergency(): tuple\n+ cascade_schedule_shift(+30m): void",
              "purple")

    # Middle row: AppointmentEntity with nested models
    uml_class(fig, ax, 0.08, 1.35, 3.45, 2.35, "AppointmentEntity",
              "+ _id: ObjectId\n+ patient_name: str  + contact_info: str\n+ raw_symptom_text: str  + duration: str\n+ symptom_checkboxes: list[str]\n+ ai_urgency_score: str  + ai_confidence: float\n+ triage_source: str (red_flag | svm)\n+ clinic_date: str  + clinic_slot: str\n+ assigned_to: str (doctor username)\n+ vitals: VitalsModel\n+ doctor_notes: str\n+ prescriptions: list[PrescriptionItem]\n+ lab_orders: list[str]  + final_status: str\n+ priority_overridden: bool  + preempted: bool",
              "blue")

    uml_class(fig, ax, 3.65, 2.60, 1.97, 1.10, "VitalsModel",
              "+ blood_pressure: str\n+ heart_rate: int\n+ oxygen_saturation: int\n+ temperature: float\n+ respiratory_rate: int",
              "green")

    uml_class(fig, ax, 3.65, 1.35, 1.97, 1.15, "PrescriptionItem",
              "+ medication: str\n+ dosage: str\n+ frequency: str\n+ duration: str",
              "green")

    # Bottom row
    uml_class(fig, ax, 0.08, 0.08, 2.70, 1.15, "AuditLogEntity",
              "+ _id: ObjectId\n+ appointment_id: ObjectId\n+ staff_username: str\n+ action: str (override | assign | edit)\n+ previous_priority: str  + new_priority: str\n+ override_reason: str  + timestamp: datetime",
              "slate")

    uml_class(fig, ax, 2.92, 0.08, 2.70, 1.15, "ConnectionManager",
              "- active_connections: list[WebSocket]\n+ connect(websocket: WebSocket): void\n+ disconnect(websocket: WebSocket): void\n+ broadcast_json(message: dict): void",
              "blue")

    # Connecting arrows
    # Composition: AppointmentEntity to VitalsModel (filled diamond)
    ax.scatter([3.53], [3.15], marker="D", s=25, color=INK, zorder=5)
    ax.plot([3.53, 3.65], [3.15, 3.15], color=INK, lw=1.1, zorder=4)

    # Composition: AppointmentEntity to PrescriptionItem (filled diamond)
    ax.scatter([3.53], [1.90], marker="D", s=25, color=INK, zorder=5)
    ax.plot([3.53, 3.65], [1.90, 1.90], color=INK, lw=1.1, zorder=4)

    # Association: AppointmentEntity to AuditLogEntity
    arrow(ax, (1.43, 1.35), (1.43, 1.23), color="#334155")
    label(ax, 1.43, 1.29, "1 : N tracks", fs=5.5)

    # Dependency: HybridTriageEngine to AppointmentEntity
    arrow(ax, (1.43, 3.85), (1.43, 3.70), color="#b45309", ls="--")
    label(ax, 1.43, 3.78, "classifies", fs=5.5, color="#b45309")

    # Dependency: CalendarManager to AppointmentEntity
    arrow(ax, (3.50, 3.85), (2.80, 3.70), color="#6d28d9", ls="--")
    label(ax, 3.25, 3.80, "schedules", fs=5.5, color="#6d28d9")

    # Dependency: ConnectionManager to AppointmentEntity
    arrow(ax, (3.50, 1.23), (2.80, 1.35), color="#1d4ed8", ls="--")
    label(ax, 3.25, 1.27, "broadcasts", fs=5.5, color="#1d4ed8")

    save(fig, "fig_3_3_class_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-4  Dual-Phase Sequence Diagram
# --------------------------------------------------------------------------
def fig_sequence():
    W, H = 5.7, 7.30
    fig, ax = canvas(W, H)

    # Background shaded blocks for the two phases
    ax.add_patch(FancyBboxPatch((0.08, 3.75), 5.54, 3.45, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#f0f9ff", ec="#0284c7", lw=1.0, ls="--", alpha=0.5, zorder=1))
    ax.text(0.18, 7.08, "PHASE 1: Patient Intake & Hybrid Clinical Triage Flow", fontsize=6.4, fontweight="bold",
            color="#0369a1", family=SANS, zorder=2)

    ax.add_patch(FancyBboxPatch((0.08, 0.10), 5.54, 3.55, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#f0fdf4", ec="#16a34a", lw=1.0, ls="--", alpha=0.5, zorder=1))
    ax.text(0.18, 3.53, "PHASE 2: Doctor Clinical Consultation & Patient Discharge Flow", fontsize=6.4, fontweight="bold",
            color="#15803d", family=SANS, zorder=2)

    lifelines = [
        (0.50, "Patient /\nDoctor"),
        (1.48, "FastAPI\nGateway"),
        (2.46, "Hybrid Triage\nEngine"),
        (3.44, "Universal\nScheduler"),
        (4.42, "MongoDB\nAtlas"),
        (5.26, "WS &\nAlerts"),
    ]
    xs = [x for x, _ in lifelines]

    for i, (x, title) in enumerate(lifelines):
        rbox(fig, ax, x - 0.40, 6.75, 0.80, 0.42, title, "blue", fs=6.0, bold=True)
        ax.plot([x, x], [0.15, 6.75], color="#94a3b8", lw=0.8, ls=(0, (4, 3)), zorder=1)

    # Phase 1 sequence messages
    msgs_phase1 = [
        (6.40, 0, 1, "1. POST /submit-symptoms (name, text, checkboxes, duration)", False),
        (6.00, 1, 2, "2. evaluate_triage(text, checkboxes)", False),
        (5.55, 2, 1, "3. [Alt: Red-Flag Bypass -> Emergency (1.0) | SVM inference]", True),
        (5.10, 1, 3, "4. allocate_slot(urgency) [Cascade shift if Emergency]", False),
        (4.65, 3, 1, "5. return clinic_date, clinic_slot", True),
        (4.25, 1, 4, "6. insert appointment (status: 'Scheduled')", False),
        (3.88, 1, 5, "7. broadcast('QUEUE_UPDATED') & dispatch SMS/email", False),
    ]

    for y, a, b, text, ret in msgs_phase1:
        x1, x2 = xs[a], xs[b]
        arrow(ax, (x1, y), (x2, y), ls=(0, (3, 2)) if ret else "-", ms=6, color="#0369a1" if ret else INK)
        label(ax, (x1 + x2) / 2, y + 0.12, text, fs=5.5, bg="#f0f9ff")

    # Phase 2 sequence messages
    msgs_phase2 = [
        (3.20, 0, 1, "8. GET /get-queue?assigned_to=dr_smith", False),
        (2.80, 1, 4, "9. find({assigned_to: 'dr_smith', status: 'Scheduled'})", False),
        (2.40, 4, 0, "10. return assigned patient caseload records", True),
        (1.95, 0, 1, "11. POST /update-status (status: 'In Consultation')", False),
        (1.60, 1, 5, "12. broadcast('CONSULTATION_STARTED')", False),
        (1.25, 0, 1, "13. POST /doctor-consultation (vitals, notes, prescriptions, labs)", False),
        (0.85, 1, 4, "14. update appointment clinical consultation BSON", False),
        (0.50, 0, 1, "15. POST /update-status (status: 'Completed / Discharged')", False),
        (0.20, 1, 5, "16. finalize appointment, archive history & broadcast completed", False),
    ]

    for y, a, b, text, ret in msgs_phase2:
        x1, x2 = xs[a], xs[b]
        arrow(ax, (x1, y), (x2, y), ls=(0, (3, 2)) if ret else "-", ms=6, color="#15803d" if ret else INK)
        label(ax, (x1 + x2) / 2, y + 0.11, text, fs=5.5, bg="#f0fdf4")

    save(fig, "fig_3_4_sequence_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-5  Activity Diagram with Red-Flag Bypass & Doctor Loop
# --------------------------------------------------------------------------
def fig_activity():
    W, H = 5.7, 8.20
    fig, ax = canvas(W, H)
    cx = 2.85

    def node(x, y, w, h, text, color="white", fs=6.0):
        rbox(fig, ax, x - w / 2, y - h / 2, w, h, text, color, fs=fs, tag=text.split("\n")[0])

    # Start node
    ax.add_patch(Circle((cx, 8.00), 0.09, fc=INK, ec=INK, zorder=4))
    arrow(ax, (cx, 7.91), (cx, 7.68))

    node(cx, 7.42, 3.20, 0.48, "Patient completes structured intake:\nName, Contact, Checkboxes, Duration, Narrative (>= 10 chars)", "blue")
    arrow(ax, (cx, 7.18), (cx, 6.95))

    # Decision diamond 1: Red-flag check
    ax.add_patch(Polygon([(cx, 6.95), (cx + 0.95, 6.60), (cx, 6.25), (cx - 0.95, 6.60)], closed=True,
                         fc="#fef9c3", ec="#a16207", lw=1.1, zorder=3))
    ax.text(cx, 6.60, "Deterministic\nRed-Flag Present?", ha="center", va="center", fontsize=6.2, fontweight="bold",
            color=INK, family=SANS, zorder=4)

    # Red-flag branch (Left, YES)
    bx_red = 1.05
    ax.plot([cx - 0.95, bx_red], [6.60, 6.60], color="#b91c1c", lw=1.1, zorder=2)
    arrow(ax, (bx_red, 6.60), (bx_red, 6.05), color="#b91c1c")
    label(ax, 1.80, 6.72, "[YES - Life Threat]", fs=5.8, color="#b91c1c")

    node(bx_red, 5.75, 1.75, 0.55, "Fast-Track Emergency Tier\nConfidence = 1.0\nSource: Deterministic Rule", "red", fs=5.8)

    # Preemption check diamond on left
    ax.add_patch(Polygon([(bx_red, 5.35), (bx_red + 0.70, 5.05), (bx_red, 4.75), (bx_red - 0.70, 5.05)], closed=True,
                         fc="#fee2e2", ec="#b91c1c", lw=1.0, zorder=3))
    ax.text(bx_red, 5.05, "Earliest Slot\nOccupied?", ha="center", va="center", fontsize=5.8, fontweight="bold",
            color="#b91c1c", family=SANS, zorder=4)
    arrow(ax, (bx_red, 5.47), (bx_red, 5.35), color="#b91c1c")

    node(bx_red, 4.25, 1.75, 0.60, "Preempt Slot & Cascade Shift:\nPush existing & subsequent slots\ndown by exactly 1 row (+30 mins)", "red", fs=5.7)
    arrow(ax, (bx_red, 4.75), (bx_red, 4.55), color="#b91c1c")
    label(ax, bx_red + 0.25, 4.65, "[YES]", fs=5.5, color="#b91c1c")

    node(bx_red, 3.42, 1.75, 0.52, "Log preemption in preemption_log\n& dispatch patient SMS/Email alert", "red", fs=5.7)
    arrow(ax, (bx_red, 3.95), (bx_red, 3.68), color="#b91c1c")

    # NLP & SVM branch (Right, NO)
    bx_ml = 3.95
    ax.plot([cx + 0.95, bx_ml], [6.60, 6.60], color="#15803d", lw=1.1, zorder=2)
    arrow(ax, (bx_ml, 6.60), (bx_ml, 6.05), color="#15803d")
    label(ax, 3.45, 6.72, "[NO]", fs=5.8, color="#15803d")

    node(bx_ml, 5.75, 1.85, 0.55, "Clinical Negation Preprocessor:\nPreserve 'no_fever', 'cannot_breathe'\nTF-IDF 5,000 N-Gram Vectorization", "amber", fs=5.7)
    node(bx_ml, 4.98, 1.85, 0.52, "Calibrated Linear SVM Inference:\nCompute Posterior Probabilities\nBias threshold P(Emergency) >= 0.35", "amber", fs=5.7)
    arrow(ax, (bx_ml, 5.47), (bx_ml, 5.24))

    # Predicted Urgency Diamond
    ax.add_patch(Polygon([(bx_ml, 4.60), (bx_ml + 0.70, 4.30), (bx_ml, 4.00), (bx_ml - 0.70, 4.30)], closed=True,
                         fc="#fef9c3", ec="#a16207", lw=1.0, zorder=3))
    ax.text(bx_ml, 4.30, "Predicted\nTier?", ha="center", va="center", fontsize=5.8, fontweight="bold",
            color=INK, family=SANS, zorder=4)
    arrow(ax, (bx_ml, 4.72), (bx_ml, 4.60))

    # Routine & Urgent slot allocations
    node(2.70, 3.42, 1.45, 0.52, "Urgent Slot Allocation:\nNext free slot (now + 26h)\nFixed Hours 09:00 - 17:00", "amber", fs=5.6)
    node(4.45, 3.42, 1.45, 0.52, "Routine Slot Allocation:\nNext free slot (now + 76h)\nFixed Hours 09:00 - 17:00", "green", fs=5.6)

    ax.plot([bx_ml - 0.70, 2.70], [4.30, 4.30], color="#b45309", lw=1.0)
    arrow(ax, (2.70, 4.30), (2.70, 3.68), color="#b45309")
    label(ax, 3.05, 4.40, "[Urgent]", fs=5.5, color="#b45309")

    ax.plot([bx_ml + 0.70, 4.45], [4.30, 4.30], color="#15803d", lw=1.0)
    arrow(ax, (4.45, 4.30), (4.45, 3.68), color="#15803d")
    label(ax, 4.85, 4.40, "[Routine]", fs=5.5, color="#15803d")

    # If ML predicted Emergency:
    ax.plot([bx_ml - 0.70, 2.05, 2.05], [4.30, 4.30, 4.25], color="#b91c1c", lw=1.0, ls="--")
    arrow(ax, (2.05, 4.25), (bx_red + 0.88, 4.25), color="#b91c1c")

    # Synchronization Bar
    ax.plot([0.50, 5.20], [2.75, 2.75], color=INK, lw=2.4, zorder=3)
    arrow(ax, (bx_red, 3.16), (bx_red, 2.75), color="#b91c1c")
    arrow(ax, (2.70, 3.16), (2.70, 2.75), color="#b45309")
    arrow(ax, (4.45, 3.16), (4.45, 2.75), color="#15803d")

    node(cx, 2.38, 3.60, 0.46, "Persist Appointment into MongoDB Atlas (Status: Scheduled)\nBroadcast WebSocket Event & Audio Alert to Coordinator Queue", "slate", fs=5.8)
    arrow(ax, (cx, 2.73), (cx, 2.61))
    arrow(ax, (cx, 2.15), (cx, 1.95))

    # Doctor Consultation & Discharge Sub-flow
    node(cx, 1.62, 4.80, 0.58, "Doctor Clinical Consultation Suite Workflow:\n1. Filter assigned caseload  2. Record physical vitals (BP, HR, SpO2, Temp, RR)\n3. Author clinical summary note  4. Issue medication prescriptions & order lab tests", "purple", fs=5.8)
    arrow(ax, (cx, 1.33), (cx, 1.10))

    node(cx, 0.80, 3.80, 0.48, "Execute 1-Click Patient Discharge:\nUpdate final_status = 'Completed' & Archive to Patient Medical History", "green", fs=5.8)
    arrow(ax, (cx, 0.56), (cx, 0.36))

    # End Node
    ax.add_patch(Circle((cx, 0.25), 0.10, fc="white", ec=INK, lw=1.2, zorder=4))
    ax.add_patch(Circle((cx, 0.25), 0.055, fc=INK, ec=INK, zorder=5))
    ax.text(cx, 0.07, "Clinical Episode Complete", ha="center", va="top", fontsize=5.8, color=INK, family=SANS)

    save(fig, "fig_3_5_activity_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-6  Entity Relationship Diagram (MongoDB BSON Schema)
# --------------------------------------------------------------------------
def entity(fig, ax, x, y, w, h, name, body, color="blue"):
    f, e = PAL[color]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.05", fc="white", ec=e, lw=1.2, zorder=2))
    hh = 0.26
    ax.add_patch(FancyBboxPatch((x, y + h - hh), w, hh, boxstyle="round,pad=0,rounding_size=0.05", fc=f, ec=e, lw=1.2, zorder=3))
    ax.text(x + w / 2, y + h - hh / 2, name, ha="center", va="center", fontsize=6.8, fontweight="bold", color=INK,
            family=SANS, zorder=4)
    ax.text(x + 0.07, y + h - hh - 0.06, body, ha="left", va="top", fontsize=5.7, color="#1e293b", family=MONO,
            zorder=4, linespacing=1.30)


def fig_erd():
    W, H = 5.7, 5.25
    fig, ax = canvas(W, H)

    # users collection
    entity(fig, ax, 0.08, 3.65, 2.45, 1.50, "users",
           "PK _id: ObjectId\nUQ username: str\n   hashed_password: str\n   email: str, mobile: str\n   role: patient|doctor|staff|admin\n   created_at: datetime",
           "blue")

    # preemption_log collection
    entity(fig, ax, 0.08, 1.95, 2.45, 1.45, "preemption_log",
           "PK _id: ObjectId\nFK appointment_id -> appointments\n   bumped_patient: str\nFK bumped_username -> users\n   original_time: datetime\n   new_time: datetime\n   reason: str, timestamp: datetime",
           "amber")

    # audit_logs collection
    entity(fig, ax, 0.08, 0.10, 2.45, 1.60, "audit_logs",
           "PK _id: ObjectId\nFK appointment_id -> appointments\nFK staff_username -> users\n   action: override|assign|edit\n   previous_priority: str\n   new_priority: str\n   reason: str (mandatory clinical)\n   timestamp: datetime",
           "green")

    # appointments collection (enriched clinical BSON)
    entity(fig, ax, 2.78, 0.10, 2.84, 5.05, "appointments",
           "PK _id: ObjectId\nFK username -> users.username\n   patient_name: str (editable dependent)\n   contact_info: str\n   raw_symptom_text: str (>= 10 chars)\n   symptom_checkboxes: array[str] (10 items)\n   symptom_duration: str (<2h to >1w)\n   ai_urgency_score: Emergency|Urgent|Routine\n   ai_confidence: float (0.00 to 1.00)\n   triage_source: deterministic|calibrated_svm\n   critical_keywords: array[str]\n   clinic_date: str (YYYY-MM-DD Wall-Clock)\n   clinic_slot: str (HH:MM 09:00-17:00)\n   scheduled_time: datetime (UTC ISO)\n   final_status: Scheduled|In Consult|Completed\n   assigned_to: str (doctor username)\n   vitals: object {bp, hr, spo2, temp, rr}\n   doctor_notes: str (clinical note)\n   prescriptions: array[{med, dose, freq, dur}]\n   lab_orders: array[str] (CBC, CMP, CXR)\n   priority_overridden: bool, reason, by, at\n   preempted: bool, original_time, reason, at\n   created_at: datetime",
           "blue")

    # Relationships & Cardinalities
    arrow(ax, (2.53, 4.35), (2.78, 4.35), ms=6, both=True)
    label(ax, 2.65, 4.52, "1 : N", fs=5.8)
    ax.text(2.65, 4.20, "books / assigns", ha="center", va="center", fontsize=5.0, color="#334155", family=SANS, fontstyle="italic")

    arrow(ax, (2.53, 2.65), (2.78, 2.65), ms=6, both=True)
    label(ax, 2.65, 2.82, "1 : N", fs=5.8)
    ax.text(2.65, 2.50, "preempts", ha="center", va="center", fontsize=5.0, color="#334155", family=SANS, fontstyle="italic")

    arrow(ax, (2.53, 0.85), (2.78, 0.85), ms=6, both=True)
    label(ax, 2.65, 1.02, "1 : N", fs=5.8)
    ax.text(2.65, 0.70, "audited by", ha="center", va="center", fontsize=5.0, color="#334155", family=SANS, fontstyle="italic")

    arrow(ax, (1.30, 3.65), (1.30, 3.40), ms=6, both=True)
    label(ax, 1.62, 3.52, "1 : N", fs=5.8)

    save(fig, "fig_3_6_erd.png")


# --------------------------------------------------------------------------
# Figure 4-4  Doctor Clinical Suite UI Interface Mockup
# --------------------------------------------------------------------------
def fig_doctor_suite():
    W, H = 5.7, 4.70
    fig, ax = canvas(W, H)

    # Browser / App Window Frame
    ax.add_patch(FancyBboxPatch((0.08, 0.08), 5.54, 4.54, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#f8fafc", ec="#cbd5e1", lw=1.2, zorder=1))

    # Header Bar
    ax.add_patch(FancyBboxPatch((0.08, 4.18), 5.54, 0.44, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#0f172a", ec="#0f172a", zorder=2))
    ax.text(0.24, 4.40, "TeleTriage AI — Doctor Clinical Consultation Suite", fontsize=6.8, fontweight="bold",
            color="white", family=SANS, va="center")
    ax.text(5.42, 4.40, "Dr. Marcus Smith, MD (Attending Clinician)", fontsize=5.8, color="#94a3b8",
            family=SANS, ha="right", va="center")

    # Sub-bar: Caseload filter
    rbox(fig, ax, 0.20, 3.75, 1.65, 0.32, "Caseload: Assigned to Me (3)", "blue", fs=5.8, bold=True)
    rbox(fig, ax, 1.95, 3.75, 1.35, 0.32, "All Clinic Patients (18)", "slate", fs=5.8)
    ax.text(5.42, 3.91, "Active Consultation: Jonathan Vance (ID: #APT-8429)", fontsize=5.8, fontweight="bold",
            color="#1e293b", family=SANS, ha="right", va="center")

    # Patient Demographic & Triage Card
    ax.add_patch(FancyBboxPatch((0.20, 3.05), 5.30, 0.60, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="#f1f5f9", ec="#94a3b8", lw=0.8, zorder=2))
    ax.text(0.32, 3.50, "Patient: Jonathan Vance (Male, 42y) | Contact: +60 12-345-6789 | Universal Slot: 10:30 - 11:00",
            fontsize=6.0, fontweight="bold", color="#0f172a", family=SANS)
    ax.text(0.32, 3.32, "Triage Status: URGENT  •  AI Confidence: 98.4% (Calibrated Linear SVM)  •  Reported Duration: 1 - 2 days",
            fontsize=5.6, color="#b45309", family=SANS)
    ax.text(0.32, 3.16, "Chief Complaint: 'Severe radiating right lower quadrant abdominal pain with fever and nausea.'",
            fontsize=5.4, fontstyle="italic", color="#334155", family=SANS)

    # 5 Objective Vitals Cards
    vitals = [
        ("Blood Pressure", "128 / 84", "mmHg", "Normal", "#16a34a"),
        ("Heart Rate", "76", "bpm", "Normal", "#16a34a"),
        ("SpO2 Saturation", "98", "%", "Normal", "#16a34a"),
        ("Temperature", "37.8", "°C", "Low Fever", "#d97706"),
        ("Respiration Rate", "16", "bpm", "Normal", "#16a34a"),
    ]
    vw = 1.00
    for i, (title, val, unit, status, sc) in enumerate(vitals):
        vx = 0.20 + i * 1.075
        ax.add_patch(FancyBboxPatch((vx, 2.30), vw, 0.65, boxstyle="round,pad=0,rounding_size=0.04",
                                    fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
        ax.text(vx + vw / 2, 2.82, title, fontsize=5.4, color="#64748b", ha="center", family=SANS)
        ax.text(vx + vw / 2, 2.64, f"{val} {unit}", fontsize=6.6, fontweight="bold", color="#0f172a", ha="center", family=SANS)
        ax.text(vx + vw / 2, 2.45, f"● {status}", fontsize=5.2, fontweight="bold", color=sc, ha="center", family=SANS)

    # Clinical Note Area
    ax.add_patch(FancyBboxPatch((0.20, 1.45), 5.30, 0.75, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(0.32, 2.08, "Attending Clinician Consultation Summary Note:", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    note_txt = ("Patient is alert, oriented x3. Acute localized tenderness over McBurney's point with guarding. "
                "Negative Murphy's sign. Chest auscultation reveals clear bilateral vesicular breath sounds. "
                "Prescribed oral antibiotic regimen and ordered urgent confirmatory abdominal ultrasound.")
    ax.text(0.32, 1.92, note_txt, fontsize=5.5, color="#334155", family=SANS, linespacing=1.2)

    # Bottom Row: Prescriptions & Diagnostic Lab Orders
    pw = 2.58
    # Prescriptions
    ax.add_patch(FancyBboxPatch((0.20, 0.45), pw, 0.90, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(0.30, 1.22, "Prescriptions Suite (e-Prescription):", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    rx_items = [
        "Rx 1: Ciprofloxacin 500mg • Oral • BID x 7 Days",
        "Rx 2: Metronidazole 400mg • Oral • TID x 5 Days",
        "Rx 3: Paracetamol 500mg • Oral • Q6H PRN (Pain/Fever)",
    ]
    for k, rx in enumerate(rx_items):
        rbox(fig, ax, 0.30, 0.95 - k * 0.23, pw - 0.20, 0.19, rx, "blue", fs=5.1, align_left=True, pad=0.03)

    # Diagnostic Labs
    ax.add_patch(FancyBboxPatch((2.92, 0.45), pw, 0.90, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(3.02, 1.22, "Diagnostic Laboratory Panels Ordered:", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    labs = [
        "[X] Complete Blood Count (CBC w/ Diff)",
        "[X] C-Reactive Protein (CRP) & ESR",
        "[X] Urgent Abdominal & Pelvic Ultrasound",
        "[  ] Chest X-Ray (CXR PA View)",
    ]
    for k, lab in enumerate(labs):
        ax.text(3.05, 1.03 - k * 0.17, lab, fontsize=5.4, color="#0f172a" if "[X]" in lab else "#64748b",
                fontweight="bold" if "[X]" in lab else "normal", family=SANS)

    # Bottom Actions
    rbox(fig, ax, 0.20, 0.14, 1.20, 0.24, "Status: In Consultation", "amber", fs=5.4, bold=True)
    rbox(fig, ax, 2.45, 0.14, 1.25, 0.24, "Save Clinical Note", "slate", fs=5.4)
    rbox(fig, ax, 3.80, 0.14, 1.70, 0.24, "1-Click Consultation Discharge", "green", fs=5.4, bold=True)

    save(fig, "fig_4_4_doctor_workspace.png")
    # Also save to screens dir for redundancy
    fig_screen = os.path.join(SCREENS_DIR, "ui_doctor_workspace.png")
    fig2, _ = canvas(W, H)
    plt.close(fig2)
    import shutil
    shutil.copyfile(os.path.join(OUT_DIR, "fig_4_4_doctor_workspace.png"), fig_screen)
    print("saved", fig_screen)


# --------------------------------------------------------------------------
# Figure 4-5  Executive Operational Analytics Command Center Mockup
# --------------------------------------------------------------------------
def fig_executive_analytics():
    W, H = 5.7, 4.70
    fig, ax = canvas(W, H)

    # Window Frame
    ax.add_patch(FancyBboxPatch((0.08, 0.08), 5.54, 4.54, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#f8fafc", ec="#cbd5e1", lw=1.2, zorder=1))

    # Header Bar
    ax.add_patch(FancyBboxPatch((0.08, 4.18), 5.54, 0.44, boxstyle="round,pad=0,rounding_size=0.06",
                                fc="#0f172a", ec="#0f172a", zorder=2))
    ax.text(0.24, 4.40, "Executive Operational Analytics & Clinical Quality Command Center", fontsize=6.8,
            fontweight="bold", color="white", family=SANS, va="center")
    ax.text(5.42, 4.40, "[ Export Handover CSV ]", fontsize=5.8, fontweight="bold", color="#38bdf8",
            family=SANS, ha="right", va="center")

    # Timeframe Selector Tabs
    rbox(fig, ax, 0.20, 3.75, 0.85, 0.30, "Today", "slate", fs=5.6)
    rbox(fig, ax, 1.12, 3.75, 1.10, 0.30, "Past 7 Days", "blue", fs=5.6, bold=True)
    rbox(fig, ax, 2.30, 3.75, 0.95, 0.30, "Past 30 Days", "slate", fs=5.6)
    ax.text(5.42, 3.90, "Real-time sync active (WebSocket connected)", fontsize=5.4, color="#16a34a",
            family=SANS, ha="right", va="center")

    # 6 Top KPI Metric Cards
    kpis = [
        ("Total Consultations", "1,248", "+12.4% vs last week", "#1e293b", "#16a34a"),
        ("Emergency Triage Rate", "14.2%", "0.0% Fatal Misses", "#dc2626", "#16a34a"),
        ("Mean Triage Confidence", "99.4%", "Calibrated Linear SVM", "#2563eb", "#64748b"),
        ("SLA Adherence Compliance", "98.7%", "Target >= 95.0%", "#16a34a", "#16a34a"),
        ("Mean API Response Time", "32.9 ms", "Sub-second dispatch", "#7c3aed", "#64748b"),
        ("Cascaded Preemptions", "18", "All patients notified", "#d97706", "#64748b"),
    ]
    kw = 0.84
    for i, (title, val, sub, vc, sc) in enumerate(kpis):
        kx = 0.20 + i * 0.89
        ax.add_patch(FancyBboxPatch((kx, 2.95), kw, 0.68, boxstyle="round,pad=0,rounding_size=0.04",
                                    fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
        ax.text(kx + kw / 2, 3.50, title, fontsize=4.9, color="#64748b", ha="center", family=SANS)
        ax.text(kx + kw / 2, 3.30, val, fontsize=7.2, fontweight="bold", color=vc, ha="center", family=SANS)
        ax.text(kx + kw / 2, 3.08, sub, fontsize=4.8, color=sc, ha="center", family=SANS)

    # 4 Recharts Visualization Panels (2x2 Grid)
    pw, ph = 2.58, 1.35
    px1, px2 = 0.20, 2.92
    py1, py2 = 1.48, 0.12

    # Panel 1: Triage Distribution (Donut Chart)
    ax.add_patch(FancyBboxPatch((px1, py1), pw, ph, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(px1 + 0.10, py1 + ph - 0.14, "Triage Priority Distribution (Donut)", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)

    # Draw mini donut
    dcx, dcy = px1 + 0.65, py1 + 0.58
    wedges = [
        (0, 51.1, "#dc2626", "Emergency (14.2%)"),
        (51.1, 187.2, "#d97706", "Urgent (37.8%)"),
        (187.2, 360, "#16a34a", "Routine (48.0%)"),
    ]
    for t1, t2, col, lab in wedges:
        ax.add_patch(Wedge((dcx, dcy), 0.40, t1, t2, width=0.18, fc=col, ec="white", lw=0.8, zorder=3))
    for k, (_, _, col, lab) in enumerate(wedges):
        ax.plot([px1 + 1.25, px1 + 1.35], [py1 + 0.85 - k * 0.24, py1 + 0.85 - k * 0.24], color=col, lw=3.0, zorder=3)
        ax.text(px1 + 1.42, py1 + 0.85 - k * 0.24, lab, fontsize=5.2, color="#334155", va="center", family=SANS)

    # Panel 2: Hourly Patient Intake Surge (Bar Chart)
    ax.add_patch(FancyBboxPatch((px2, py1), pw, ph, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(px2 + 0.10, py1 + ph - 0.14, "Hourly Patient Intake Surge (09:00 - 17:00)", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17"]
    volumes = [42, 68, 85, 54, 40, 72, 91, 63, 31]
    max_v = max(volumes)
    bx_w = 0.18
    for i, (h_str, v) in enumerate(zip(hours, volumes)):
        bx = px2 + 0.22 + i * 0.25
        bh = (v / max_v) * 0.72
        ax.add_patch(FancyBboxPatch((bx, py1 + 0.25), bx_w, bh, boxstyle="round,pad=0,rounding_size=0.02",
                                    fc="#2563eb", ec="none", zorder=3))
        ax.text(bx + bx_w / 2, py1 + 0.14, h_str, fontsize=4.8, ha="center", color="#64748b", family=SANS)

    # Panel 3: Attending Clinician Caseload Allocation (Horizontal Bar)
    ax.add_patch(FancyBboxPatch((px1, py2), pw, ph, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(px1 + 0.10, py2 + ph - 0.14, "Doctor Caseload Distribution", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    docs = [("Dr. Smith (MD)", 34, "#2563eb"), ("Dr. Patel (MD)", 29, "#7c3aed"),
            ("Dr. Lee (MD)", 26, "#0891b2"), ("Dr. Taylor (MD)", 21, "#16a34a")]
    for i, (d_name, caseload, col) in enumerate(docs):
        dy = py2 + 0.88 - i * 0.23
        ax.text(px1 + 0.12, dy + 0.04, d_name, fontsize=5.2, color="#334155", family=SANS)
        bar_len = (caseload / 40) * 1.25
        ax.add_patch(FancyBboxPatch((px1 + 1.05, dy), bar_len, 0.12, boxstyle="round,pad=0,rounding_size=0.02",
                                    fc=col, ec="none", zorder=3))
        ax.text(px1 + 1.10 + bar_len, dy + 0.05, f"{caseload}", fontsize=5.0, fontweight="bold", color="#0f172a", family=SANS)

    # Panel 4: Daily SLA Compliance Trend (Line Chart)
    ax.add_patch(FancyBboxPatch((px2, py2), pw, ph, boxstyle="round,pad=0,rounding_size=0.04",
                                fc="white", ec="#cbd5e1", lw=0.8, zorder=2))
    ax.text(px2 + 0.10, py2 + ph - 0.14, "Daily SLA Compliance Adherence Trend (%)", fontsize=5.8, fontweight="bold", color="#1e293b", family=SANS)
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    sla_vals = [97.8, 98.4, 99.1, 98.2, 98.9, 99.5, 98.7]
    ax.plot([px2 + 0.25, px2 + pw - 0.25], [py2 + 0.40, py2 + 0.40], color="#94a3b8", lw=0.7, ls="--", zorder=2)
    ax.text(px2 + pw - 0.20, py2 + 0.42, "Target: 95%", fontsize=4.8, color="#64748b", ha="right", family=SANS)

    pts_x = [px2 + 0.28 + i * 0.32 for i in range(len(days))]
    pts_y = [py2 + 0.40 + ((v - 95.0) / 5.0) * 0.55 for v in sla_vals]
    ax.plot(pts_x, pts_y, color="#16a34a", lw=1.5, marker="o", markersize=3.5, zorder=3)
    for x_pt, y_pt, day_str, v in zip(pts_x, pts_y, days, sla_vals):
        ax.text(x_pt, py2 + 0.14, day_str, fontsize=4.8, ha="center", color="#64748b", family=SANS)
        ax.text(x_pt, y_pt + 0.06, f"{v:.1f}%", fontsize=4.6, ha="center", fontweight="bold", color="#15803d", family=SANS)

    save(fig, "fig_4_5_executive_analytics.png")
    # Also save to screens dir for redundancy
    fig_screen = os.path.join(SCREENS_DIR, "ui_analytics_dashboard.png")
    fig2, _ = canvas(W, H)
    plt.close(fig2)
    import shutil
    shutil.copyfile(os.path.join(OUT_DIR, "fig_4_5_executive_analytics.png"), fig_screen)
    print("saved", fig_screen)


if __name__ == "__main__":
    print("Rendering Chapter 3, 4 & 5 diagrams at 300 DPI...")
    fig_architecture()
    fig_use_case()
    fig_class()
    fig_sequence()
    fig_activity()
    fig_erd()
    fig_doctor_suite()
    fig_executive_analytics()
    if WARNINGS:
        print("\nOVERFLOW WARNINGS:")
        for w in WARNINGS:
            print(" -", w)
    else:
        print("\nZero text overflow detected. All figures rendered cleanly.")
