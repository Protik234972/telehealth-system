"""Chapter 3 diagrams for the FYP report, drawn at final print size (5.7 in wide).

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
from matplotlib.patches import Circle, Ellipse, FancyArrowPatch, FancyBboxPatch, Polygon

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(BASE_DIR, "report_charts")
os.makedirs(OUT_DIR, exist_ok=True)


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
    tol = 0.02
    if x0 < x - tol or x1 > x + w + tol or y0 < y - tol or y1 > y + h + tol:
        WARNINGS.append(f"{tag}: text {x1 - x0:.2f} x {y1 - y0:.2f} in exceeds box {w:.2f} x {h:.2f} in")


def rbox(fig, ax, x, y, w, h, text="", color="white", fs=7, bold=False, lw=1.0, ls="-", tag="",
         fc=None, ec=None, z=3):
    f, e = PAL[color]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.06",
                                fc=fc or f, ec=ec or e, lw=lw, ls=ls, zorder=z))
    if text:
        t = ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=fs, color=INK,
                    fontweight="bold" if bold else "normal", family=SANS, zorder=z + 1, linespacing=1.18)
        check_fit(fig, ax, t, x, y, w, h, tag or text.split("\n")[0])


def arrow(ax, p1, p2, color="#334155", lw=1.0, ls="-", both=False, ms=8, z=2):
    ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="<|-|>" if both else "-|>", mutation_scale=ms,
                                 color=color, lw=lw, ls=ls, zorder=z, shrinkA=0, shrinkB=0))


def label(ax, x, y, s, fs=6.3, color="#334155", ha="center", italic=False, bg="white", z=7):
    ax.text(x, y, s, ha=ha, va="center", fontsize=fs, color=color, family=SANS,
            fontstyle="italic" if italic else "normal", zorder=z, linespacing=1.1,
            bbox=dict(boxstyle="round,pad=0.07", fc=bg, ec="none"))


def save(fig, name):
    out = os.path.join(OUT_DIR, name)
    fig.savefig(out, dpi=300, facecolor="white")
    plt.close(fig)
    print("saved", out)


# --------------------------------------------------------------------------
# Figure 3-1  Three-tier architecture
# --------------------------------------------------------------------------
def fig_architecture():
    W, H = 5.7, 5.25
    fig, ax = canvas(W, H)
    tiers = [
        ("PRESENTATION", 4.05, 1.05, "blue"),
        ("APPLICATION SERVER", 1.55, 2.10, "purple"),
        ("DATA / SERVICES", 0.10, 1.05, "green"),
    ]
    for name, y, h, c in tiers:
        f, e = PAL[c]
        ax.add_patch(FancyBboxPatch((0.32, y), 5.33, h, boxstyle="round,pad=0,rounding_size=0.08",
                                    fc=f, ec=e, lw=1.2, ls="--", zorder=1, alpha=0.55))
        ax.text(0.16, y + h / 2, name, rotation=90, ha="center", va="center", fontsize=6.6,
                fontweight="bold", color=e, family=SANS)

    xs = [0.47, 2.20, 3.93]
    bw = 1.55
    t1 = ["Patient Portal & Dashboard\nintake form, own appointments",
          "Coordinator Dashboard\nlive queue, override, assign",
          "Admin Analytics\ntriage distribution, KPIs"]
    for x, t in zip(xs, t1):
        rbox(fig, ax, x, 4.22, bw, 0.68, t, "white", fs=6.6, ec=PAL["blue"][1])

    rbox(fig, ax, xs[0], 2.62, bw, 0.80, "REST & Auth Gateway\nHS256 JWT, Pydantic\nvalidation, role checks",
         "white", fs=6.6, ec=PAL["purple"][1])
    rbox(fig, ax, xs[1], 2.62, bw, 0.80, "AI Triage Engine\nspaCy + TF-IDF + calibrated\nlinear SVM (worker thread)",
         "white", fs=6.6, ec=PAL["amber"][1], fc="#fffbeb")
    rbox(fig, ax, xs[2], 2.62, bw, 0.80, "CalendarManager\n30-min slots, business\nhours, preemption",
         "white", fs=6.6, ec=PAL["purple"][1])
    arrow(ax, (xs[0] + bw, 3.02), (xs[1], 3.02))
    arrow(ax, (xs[1] + bw, 3.02), (xs[2], 3.02))

    rbox(fig, ax, xs[0], 1.70, bw, 0.62, "WebSocket Manager\n/ws broadcast", "white", fs=6.6, ec=PAL["purple"][1])
    rbox(fig, ax, xs[2], 1.70, bw, 0.62, "Background Tasks\ne-mail and SMS", "white", fs=6.6, ec=PAL["purple"][1])
    arrow(ax, (xs[0] + bw / 2, 2.62), (xs[0] + bw / 2, 2.32))
    arrow(ax, (xs[2] + bw / 2, 2.62), (xs[2] + bw / 2, 2.32))
    label(ax, xs[0] + bw / 2 + 0.07, 2.47, "notify", ha="left", fs=6)
    label(ax, xs[2] + bw / 2 + 0.07, 2.47, "dispatch", ha="left", fs=6)

    rbox(fig, ax, xs[0], 0.24, 2.0, 0.74, "MongoDB Atlas (Motor, async)\nusers, appointments,\npreemption_log, audit_logs",
         "white", fs=6.6, ec=PAL["green"][1])
    rbox(fig, ax, 2.68, 0.24, 1.35, 0.74, "Gmail SMTP\n(e-mail)", "white", fs=6.6, ec=PAL["green"][1])
    rbox(fig, ax, 4.17, 0.24, 1.33, 0.74, "Twilio SMS API\n(SMS)", "white", fs=6.6, ec=PAL["green"][1])

    arrow(ax, (1.25, 4.05), (1.25, 3.65), color="#1d4ed8")
    label(ax, 1.33, 3.85, "HTTPS REST (JSON + JWT)", ha="left")
    arrow(ax, (4.70, 3.65), (4.70, 4.05), color="#1d4ed8")
    label(ax, 4.62, 3.85, "WebSocket push", ha="right")
    arrow(ax, (1.25, 1.55), (1.25, 1.15), color="#15803d")
    label(ax, 1.33, 1.35, "Motor driver (TLS)", ha="left")
    arrow(ax, (4.00, 1.55), (4.00, 1.15), color="#15803d")
    label(ax, 4.08, 1.35, "SMTP / REST API", ha="left")
    save(fig, "fig_3_1_system_architecture.png")


# --------------------------------------------------------------------------
# Figure 3-2  Use case diagram
# --------------------------------------------------------------------------
def stick(ax, cx, cy, name, color):
    ax.add_patch(Circle((cx, cy + 0.30), 0.085, fc="white", ec=color, lw=1.3, zorder=4))
    ax.plot([cx, cx], [cy + 0.215, cy - 0.05], color=color, lw=1.3, zorder=4)
    ax.plot([cx - 0.14, cx + 0.14], [cy + 0.14, cy + 0.14], color=color, lw=1.3, zorder=4)
    ax.plot([cx, cx - 0.11], [cy - 0.05, cy - 0.27], color=color, lw=1.3, zorder=4)
    ax.plot([cx, cx + 0.11], [cy - 0.05, cy - 0.27], color=color, lw=1.3, zorder=4)
    ax.text(cx, cy - 0.36, name, ha="center", va="top", fontsize=7, fontweight="bold", color=color,
            family=SANS, linespacing=1.1)


def fig_use_case():
    W, H = 5.7, 7.0
    fig, ax = canvas(W, H)
    ax.add_patch(FancyBboxPatch((1.0, 0.12), 3.70, 6.76, boxstyle="round,pad=0,rounding_size=0.08",
                                fc="#f8fafc", ec=INK, lw=1.4, zorder=1))
    ax.text(2.85, 6.68, "TeleTriage AI: Triage & Scheduling System", ha="center", va="center", fontsize=7.5,
            fontweight="bold", color=INK, family=SANS)

    uw, uh = 1.52, 0.60
    left, right = 1.85, 3.85
    ucs = {
        "uc1": (left, 6.05, "UC-01 Register / Login\n(JWT, all roles)"),
        "uc2": (left, 5.15, "UC-02 Submit Symptom\nIntake Form"),
        "uc3": (right, 5.15, "UC-03 Classify Urgency\n(spaCy + SVM)"),
        "uc4": (right, 4.30, "UC-04 Auto-Schedule &\nEmergency Preemption"),
        "uc5": (left, 4.30, "UC-05 View Appointments\n& Preemption Alerts"),
        "uc6": (left, 3.20, "UC-06 Monitor Live\nPriority Queue"),
        "uc7": (left, 2.35, "UC-07 Override Priority\n(reason + audit log)"),
        "uc8": (left, 1.50, "UC-08 Edit Schedule /\nAssign Doctor / Dismiss"),
        "uc9": (left, 0.65, "UC-09 View Preemption\n& Audit Logs"),
        "uc10": (right, 2.35, "UC-10 View Analytics\n& Triage KPIs"),
    }
    for cx, cy, txt in ucs.values():
        ax.add_patch(Ellipse((cx, cy), uw, uh, fc="white", ec="#1d4ed8", lw=1.1, zorder=3))
        t = ax.text(cx, cy, txt, ha="center", va="center", fontsize=6.3, color=INK, family=SANS,
                    zorder=4, linespacing=1.12)
        check_fit(fig, ax, t, cx - uw * 0.44, cy - uh / 2, uw * 0.88, uh, txt.split("\n")[0])

    stick(ax, 0.45, 4.85, "Patient", PAL["blue"][1])
    stick(ax, 0.45, 2.15, "Clinic Staff /\nCoordinator", PAL["purple"][1])
    stick(ax, 5.25, 4.55, "AI NLP &\nScheduler\nEngine", PAL["amber"][1])
    stick(ax, 5.25, 2.15, "Admin", PAL["green"][1])
    ax.text(5.25, 1.55, "(also inherits all\nCoordinator\nuse cases)", ha="center", va="top", fontsize=5.8,
            color=PAL["green"][1], family=SANS, fontstyle="italic", linespacing=1.1)

    def assoc(actor_xy, uc, side, color):
        cx, cy, _ = ucs[uc]
        ex = cx - uw / 2 if side == "L" else cx + uw / 2
        ax.plot([actor_xy[0], ex], [actor_xy[1], cy], color=color, lw=1.0, zorder=2)

    for uc in ("uc1", "uc2", "uc5"):
        assoc((0.62, 4.99), uc, "L", PAL["blue"][1])
    for uc in ("uc6", "uc7", "uc8", "uc9"):
        assoc((0.62, 2.29), uc, "L", PAL["purple"][1])
    for uc in ("uc3", "uc4"):
        assoc((5.08, 4.69), uc, "R", PAL["amber"][1])
    assoc((5.08, 2.29), "uc10", "R", PAL["green"][1])

    arrow(ax, (left + uw / 2, 5.15), (right - uw / 2, 5.15), color="#475569", ls="--", ms=7)
    label(ax, (left + right) / 2, 5.27, "<<include>>", fs=5.8, italic=True)
    arrow(ax, (left + uw / 2 - 0.05, 4.93), (right - uw / 2 + 0.03, 4.43), color="#475569", ls="--", ms=7)
    label(ax, (left + right) / 2 + 0.02, 4.64, "<<include>>", fs=5.8, italic=True)
    save(fig, "fig_3_2_use_case_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-3  Backend class / module diagram
# --------------------------------------------------------------------------
def uml_class(fig, ax, x, y, w, h, title, body, color):
    f, e = PAL[color]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.05", fc="white", ec=e, lw=1.1, zorder=2))
    hh = 0.27
    ax.add_patch(FancyBboxPatch((x, y + h - hh), w, hh, boxstyle="round,pad=0,rounding_size=0.05", fc=f, ec=e, lw=1.1, zorder=3))
    t = ax.text(x + w / 2, y + h - hh / 2, title, ha="center", va="center", fontsize=6.8, fontweight="bold",
                color=INK, family=SANS, zorder=4)
    check_fit(fig, ax, t, x, y + h - hh, w, hh, "title:" + title)
    b = ax.text(x + 0.07, y + h - hh - 0.07, body, ha="left", va="top", fontsize=6.2, color="#1e293b",
                family=MONO, zorder=4, linespacing=1.3)
    check_fit(fig, ax, b, x, y, w, h - hh, "body:" + title)


def fig_class():
    W, H = 5.7, 3.95
    fig, ax = canvas(W, H)
    bw = 1.55
    xs = [0.05, 2.075, 4.10]
    top_y, top_h = 2.65, 1.25
    bot_y, bot_h = 0.05, 1.70
    uml_class(fig, ax, xs[0], top_y, bw, top_h, "CalendarManager",
              "<<static>>\n+ _round_to_slot()\n+ _enforce_business_hours()\n+ get_next_available_slot()\n+ preempt_for_emergency()", "blue")
    uml_class(fig, ax, xs[1], top_y, bw, top_h, "ConnectionManager",
              "- active_connections\n+ connect(websocket)\n+ disconnect(websocket)\n+ broadcast(message)", "purple")
    uml_class(fig, ax, xs[2], top_y, bw, top_h, "ML pipeline",
              "- nlp (spaCy model)\n- triage_model\n  (TF-IDF + calibrated SVC)\n+ preprocess_text()\n+ _run_triage_inference()", "amber")
    uml_class(fig, ax, xs[0], bot_y, bw, bot_h, "Pydantic schemas",
              "UserCreate\nSymptomRequest (>= 10 chars)\nStatusUpdate\nPriorityOverride (+ reason)\nScheduleOverride", "blue")
    uml_class(fig, ax, xs[1], bot_y, bw, bot_h, "FastAPI endpoints",
              "/register  /login\n/submit-symptoms\n/get-queue  /staff-list\n/update-status\n/override-priority\n/override-schedule\n/preemption-log\n/audit-logs  /analytics", "slate")
    uml_class(fig, ax, xs[2], bot_y, bw, bot_h, "MongoDB collections",
              "users\nappointments\npreemption_log\naudit_logs\n\nAsyncIOMotorClient:\ninsert / update / find /\naggregate", "green")

    mid_x = xs[1] + bw / 2
    top_edge, bot_edge = top_y, bot_y + bot_h
    arrow(ax, (xs[1] + 0.25, bot_edge), (xs[0] + bw - 0.25, top_edge), ms=8)
    label(ax, 1.78, 2.20, "schedules", fs=6)
    arrow(ax, (mid_x, bot_edge), (mid_x, top_edge), ms=8)
    label(ax, mid_x, 2.20, "broadcasts", fs=6)
    arrow(ax, (xs[1] + bw - 0.25, bot_edge), (xs[2] + 0.25, top_edge), ms=8)
    label(ax, 3.95, 2.20, "classifies", fs=6)
    arrow(ax, (xs[0] + bw, 0.90), (xs[1], 0.90), ms=8)
    label(ax, (xs[0] + bw + xs[1]) / 2, 1.07, "validates", fs=5.4)
    arrow(ax, (xs[1] + bw, 0.90), (xs[2], 0.90), ms=8)
    label(ax, (xs[1] + bw + xs[2]) / 2, 1.07, "persists", fs=5.4)
    save(fig, "fig_3_3_class_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-4  Sequence diagram
# --------------------------------------------------------------------------
def fig_sequence():
    W, H = 5.7, 5.85
    fig, ax = canvas(W, H)
    dy = 0.30
    parts = [(0.45, "Patient\nPortal"), (1.40, "FastAPI\nendpoint"), (2.35, "NLP worker\nthread"),
             (3.30, "Calendar\nManager"), (4.25, "MongoDB\nAtlas"), (5.20, "WS / e-mail\n/ SMS")]
    xs = []
    for i, (x, txt) in enumerate(parts):
        xs.append(x)
        rbox(fig, ax, x - 0.40, 5.50 - dy, 0.80, 0.50, txt, "blue", fs=6.4, bold=True, tag=f"participant {i}")
        ax.plot([x, x], [0.15, 5.50 - dy], color="#94a3b8", lw=0.8, ls=(0, (4, 3)), zorder=1)

    msgs = [
        (5.15, 0, 1, "1. POST /submit-symptoms", False),
        (4.58, 1, 2, "2. to_thread(preprocess\n+ predict)", False),
        (4.05, 2, 1, "3. urgency + confidence", True),
        (3.55, 1, 3, "4. next free slot, or preempt\nif Emergency", False),
        (2.95, 3, 4, "5. resolve conflicts,\nlog preemption", False),
        (2.40, 3, 1, "6. scheduled_time", True),
        (1.95, 1, 4, "7. insert appointment", False),
        (1.45, 1, 5, "8. WebSocket broadcast + background e-mail / SMS", False),
        (0.70, 1, 0, "9. 200 OK (urgency, slot,\nbanner if Emergency)", True),
    ]
    for y, a, b, text, ret in msgs:
        y = y - dy
        x1, x2 = xs[a], xs[b]
        arrow(ax, (x1, y), (x2, y), ls=(0, (3, 2)) if ret else "-", ms=7, color="#475569" if ret else INK)
        label(ax, (x1 + x2) / 2, y + 0.17, text, fs=5.7)
    save(fig, "fig_3_4_sequence_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-5  Activity diagram
# --------------------------------------------------------------------------
def fig_activity():
    W, H = 5.7, 7.6
    fig, ax = canvas(W, H)
    cx = 2.85

    def node(x, y, w, h, text, color="white", fs=6.6):
        rbox(fig, ax, x - w / 2, y - h / 2, w, h, text, color, fs=fs, tag=text.split("\n")[0])

    ax.add_patch(Circle((cx, 7.35), 0.10, fc=INK, ec=INK, zorder=4))
    node(cx, 6.80, 2.9, 0.50, "Patient signs in and submits the symptom\nform (name, contact, >= 10 characters)", "blue")
    node(cx, 6.05, 3.2, 0.55, "spaCy preprocessing: lower-case, tokenise, lemmatise,\nremove stop-words and punctuation", "amber")
    node(cx, 5.30, 3.2, 0.55, "TF-IDF + calibrated linear SVM predicts\nurgency tier and confidence", "amber")
    arrow(ax, (cx, 7.25), (cx, 7.05))
    arrow(ax, (cx, 6.55), (cx, 6.325))
    arrow(ax, (cx, 5.775), (cx, 5.575))
    arrow(ax, (cx, 5.025), (cx, 4.85))

    ax.add_patch(Polygon([(cx, 4.85), (cx + 0.80, 4.45), (cx, 4.05), (cx - 0.80, 4.45)], closed=True, fc="#fef9c3",
                         ec="#a16207", lw=1.1, zorder=3))
    ax.text(cx, 4.45, "Predicted\ntier?", ha="center", va="center", fontsize=6.6, fontweight="bold", color=INK,
            family=SANS, zorder=4)

    bxs = {"Emergency": 0.95, "Urgent": cx, "Routine": 4.75}
    ax.plot([cx - 0.80, bxs["Emergency"]], [4.45, 4.45], color="#b91c1c", lw=1.0, zorder=2)
    arrow(ax, (bxs["Emergency"], 4.45), (bxs["Emergency"], 3.85), color="#b91c1c")
    arrow(ax, (cx, 4.05), (cx, 3.85), color="#b45309")
    ax.plot([cx + 0.80, bxs["Routine"]], [4.45, 4.45], color="#15803d", lw=1.0, zorder=2)
    arrow(ax, (bxs["Routine"], 4.45), (bxs["Routine"], 3.85), color="#15803d")
    label(ax, 1.85, 4.58, "[Emergency]", fs=6, color="#b91c1c")
    label(ax, cx + 0.35, 3.95, "[Urgent]", fs=6, color="#b45309", ha="left")
    label(ax, 3.85, 4.58, "[Routine]", fs=6, color="#15803d")

    node(bxs["Emergency"], 3.30, 1.72, 1.10, "Preempt the earliest pending\nRoutine/Urgent slot (or\nnow + 30 min if none)", "red", fs=6.2)
    node(bxs["Urgent"], 3.30, 1.72, 1.10, "Next free 30-min slot\nfrom now + 26 h\n(09:00-17:00 UTC)", "amber", fs=6.2)
    node(bxs["Routine"], 3.30, 1.72, 1.10, "Next free 30-min slot\nfrom now + 76 h\n(09:00-17:00 UTC)", "green", fs=6.2)
    arrow(ax, (bxs["Emergency"], 2.75), (bxs["Emergency"], 2.45), color="#b91c1c")
    node(bxs["Emergency"], 2.05, 1.72, 0.80, "Log preemption, notify\nbumped patient, show\n999/911 banner", "red", fs=6.2)

    ax.plot([0.45, 5.25], [1.30, 1.30], color=INK, lw=2.2, zorder=3)
    arrow(ax, (bxs["Emergency"], 1.65), (bxs["Emergency"], 1.31), color="#b91c1c")
    arrow(ax, (bxs["Urgent"], 2.75), (bxs["Urgent"], 1.31), color="#b45309")
    arrow(ax, (bxs["Routine"], 2.75), (bxs["Routine"], 1.31), color="#15803d")
    node(cx, 0.85, 3.3, 0.46, "Save appointment to MongoDB and broadcast\nWebSocket update to dashboards", "slate")
    arrow(ax, (cx, 1.29), (cx, 1.08))
    arrow(ax, (cx, 0.62), (cx, 0.41))
    ax.add_patch(Circle((cx, 0.30), 0.10, fc="white", ec=INK, lw=1.2, zorder=4))
    ax.add_patch(Circle((cx, 0.30), 0.055, fc=INK, ec=INK, zorder=5))
    save(fig, "fig_3_5_activity_diagram.png")


# --------------------------------------------------------------------------
# Figure 3-6  Entity relationship diagram
# --------------------------------------------------------------------------
def entity(fig, ax, x, y, w, h, name, body, color):
    f, e = PAL[color]
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.05", fc="white", ec=e, lw=1.2, zorder=2))
    hh = 0.27
    ax.add_patch(FancyBboxPatch((x, y + h - hh), w, hh, boxstyle="round,pad=0,rounding_size=0.05", fc=f, ec=e, lw=1.2, zorder=3))
    ax.text(x + w / 2, y + h - hh / 2, name, ha="center", va="center", fontsize=7.2, fontweight="bold", color=INK,
            family=SANS, zorder=4)
    b = ax.text(x + 0.07, y + h - hh - 0.07, body, ha="left", va="top", fontsize=6.3, color="#1e293b", family=MONO,
                zorder=4, linespacing=1.42)
    check_fit(fig, ax, b, x, y, w, h - hh, "entity:" + name)


def fig_erd():
    W, H = 5.7, 3.95
    fig, ax = canvas(W, H)
    entity(fig, ax, 0.05, 2.80, 2.45, 1.10, "users",
           "PK _id: ObjectId\nUQ username: str\n   hashed_password, email\n   mobile (optional)\n   role: patient|staff|admin", "blue")
    entity(fig, ax, 0.05, 1.45, 2.45, 1.05, "preemption_log",
           "PK _id: ObjectId\n   bumped_patient: str\nFK bumped_username -> users\n   original_time, new_time\n   reason, timestamp", "amber")
    entity(fig, ax, 0.05, 0.10, 2.45, 1.05, "audit_logs",
           "PK _id: ObjectId\nFK appointment_id -> appts\nFK staff_username -> users\n   previous_priority\n   new_priority, reason, timestamp", "green")
    entity(fig, ax, 3.00, 0.10, 2.65, 3.80, "appointments",
           "PK _id: ObjectId\nFK username -> users\n\n   patient_name, contact_info\n   raw_symptom_text: str\n\n   ai_urgency_score: str\n   ai_confidence: float\n   critical_keywords: [str]\n\n   submission_time\n   scheduled_time\n   final_status: str\n   assigned_to, doctor_notes\n\n   overridden_by, override_reason\n   overridden_at\n   schedule_overridden_by\n\n   preempted: bool\n   original_time, preempted_at\n   preempt_reason", "blue")
    arrow(ax, (2.50, 3.35), (3.00, 3.35), ms=7, both=True)
    label(ax, 2.75, 3.52, "1 : N", fs=6)
    ax.text(2.75, 3.18, "submits", ha="center", va="center", fontsize=5.6, color="#334155", family=SANS, fontstyle="italic")
    arrow(ax, (1.27, 2.80), (1.27, 2.50), ms=7, both=True)
    label(ax, 1.62, 2.65, "1 : N", fs=6)
    arrow(ax, (2.50, 0.62), (3.00, 0.62), ms=7, both=True)
    label(ax, 2.75, 0.79, "N : 1", fs=6)
    save(fig, "fig_3_6_erd.png")


if __name__ == "__main__":
    fig_architecture()
    fig_use_case()
    fig_class()
    fig_sequence()
    fig_activity()
    fig_erd()
    if WARNINGS:
        print("\nOVERFLOW WARNINGS:")
        for w in WARNINGS:
            print(" -", w)
    else:
        print("\nNo text overflow detected.")
