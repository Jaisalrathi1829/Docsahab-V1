Redesign the Docsahab Hospital Console as a modern emergency operations dashboard.

IMPORTANT:
This is NOT a generic hospital management dashboard. It is an emergency-response interface where doctors and hospital staff need to understand an incoming emergency within 3 seconds and take action immediately.

DESIGN STYLE:
- Clean, minimal, premium healthcare UI
- Simple but creative and distinctive
- Calm professional interface suitable for a high-pressure emergency environment
- Avoid a generic SaaS/admin-dashboard appearance
- Spacious layout with strong visual hierarchy
- White / very light blue-gray main background
- Deep navy sidebar
- Use red only for critical emergency information
- Orange for high severity
- Yellow/amber for moderate
- Blue for low/informational states
- Green for available/ready/accepted
- Subtle shadows, thin borders, medium rounded corners
- Modern sans-serif typography
- Avoid excessive gradients, excessive glassmorphism, excessive pills, and unnecessary decoration
- Do NOT use a hospital building/photo/ambulance photo as a decorative hero image

LAYOUT:

1. LEFT SIDEBAR
Create a dark navy vertical sidebar.

Top:
Docsahab
Hospital Console

Navigation:
- Dashboard
- Emergency Queue with notification count
- Patients
- Resources
- Communication
- History

Bottom:
- "All systems operational"
- Live data connected
- Dr. Sharma
- Settings
- Log out

Keep the sidebar compact and clean.

2. TOP HEADER
Show:
St. Vincent Medical Center
Emergency Wing

Capacity indicators:
- ER Beds: 8 / 12
- ICU: 3 / 5
- Trauma Bay: Ready

Right side:
- Online · Accepting
- Notification icon
- Staff avatar
- Current date/time

3. LEFT MAIN COLUMN — EMERGENCY QUEUE
Create a compact emergency queue.

Title:
Emergency Queue
3 active

Each emergency should be easy to scan.

Case 01:
CRITICAL
Cardiac Emergency
Ambulance #204
2.8 km
ETA 4 min
Penicillin allergy · Prior MI · Hypertension

Case 02:
HIGH
Severe Trauma — RTA
Ambulance #118
5.6 km
ETA 8 min
Suspected internal bleeding

Case 03:
MODERATE
Severe Burns
Ambulance #315
9.2 km
ETA 14 min
Airway support required

Case 04:
LOW
Respiratory Distress
Ambulance #262
12.4 km
ETA 22 min

Case 05:
LOW
Accident — Head Injury
Ambulance #176
15.8 km
ETA 28 min

Make the selected critical case visually distinct but not overly bright.

4. CENTER — ACTIVE EMERGENCY
This is the most important area.

At the top create a prominent but clean critical emergency header.

Show:

CRITICAL

Cardiac Emergency

Ambulance #204
2.8 km
ETA 4 min

Show:
Penicillin allergy
Prior MI
Hypertension

On the right side of this header:
ARRIVING IN
04:12

Use a large countdown.

Do NOT put any hospital or ambulance photograph here.
Use only subtle icons/illustrations if needed.

5. PATIENT INFORMATION
Create a clean patient information card.

Patient:
Rajesh Kumar
42 years · Male
Patient ID: P-45872

Blood Group:
B+

Allergies:
Penicillin

Previous Conditions:
Prior MI, Hypertension

Use a neutral avatar placeholder, not a real person's photograph.

6. LIVE MONITORING
IMPORTANT:
Do NOT create separate large Heart Rate, BP, SpO2, and Temperature cards.

Instead, create ONE unified "Live Monitoring" section.

Inside it show:
- ECG waveform / heart rhythm visualization
- Respiratory rate
- Oxygen saturation
- Live connection indicator
- Last updated time

Example:
ECG — Normal Sinus Rhythm
Respiratory Rate — 22/min — Normal
Oxygen Saturation — 93% — Low

Add:
"View full vitals & trends →"

The monitoring section should visually communicate that ambulance telemetry is continuously streaming.

7. PATIENT STATUS / EMERGENCY TIMELINE
Create a compact horizontal timeline:

SOS Triggered — 14:02
Ambulance Assigned — 14:03
Patient Picked Up — 14:09
Severity Updated — 14:11
Hospital Acceptance Requested — 14:14

Use simple connected timeline indicators.

8. AMBULANCE INFORMATION
Create a compact section showing:

Ambulance #204
Vehicle No. KA 01 AB 204
Driver: Ramesh Yadav
Current Location: 2.8 km en route

Button:
Track Live →

9. RIGHT COLUMN — HOSPITAL READINESS
Create a prominent "Hospital Readiness" card.

Show:
5/5
READY FOR ARRIVAL

Resources:
✓ Emergency Bed — Assigned
✓ Cardiologist — Assigned
✓ ICU — Available
✓ Cath Lab — Ready
✓ Nursing Team — Notified

Use green status indicators.

10. PREPARATION CHECKLIST
Create a dedicated preparation checklist.

Title:
Preparation Checklist

5/5

✓ Emergency Bed Assigned
✓ Cardiologist Assigned
✓ ICU Bed Available
✓ Cath Lab Ready
✓ Nursing Team Notified

This should communicate operational readiness at a glance.

11. HOSPITAL DECISION
Create a clearly visible decision card.

Title:
Hospital Decision

Text:
Respond within 00:37

Primary action:
ACCEPT & PREPARE

Secondary action:
CANNOT ACCEPT

The Accept button should be the strongest action on the page.

12. QUICK COMMUNICATION
Create a compact communication area.

Actions:
- Call Ambulance
- Message EMS
- Notify Blood Bank
- Notify Pharmacy

Keep this smaller than the emergency decision section.

13. FIXED BOTTOM EMERGENCY BAR
Add a persistent bottom bar.

Show:

Cardiac Emergency
Arriving in 04:12
Ambulance #204
2.8 km

Hospital Readiness:
5/5

Actions:
Call Ambulance
Message EMS

Right side:
Patient can be received
5/5 ready

This bar should remain visually prominent without becoming distracting.

UX PRINCIPLES:
- Critical information must be visible without scrolling
- ETA must be one of the largest pieces of information
- Emergency severity must be immediately recognizable
- Hospital readiness must be understandable at a glance
- The primary action must require one clear click
- Keep secondary information visually quieter
- Avoid information overload
- Use progressive disclosure for detailed medical history and full vitals
- Never use red for ordinary interface elements
- Maintain strong accessibility and readable contrast
- Make the interface feel calm despite the emergency context

CREATIVE DIRECTION:
The unique visual concept should be "Calm Command Center".

The dashboard should feel like a combination of:
modern clinical interface + emergency control room + real-time coordination system.

Do not make it look like a typical hospital ERP or admin panel.

The final result should be minimal, highly professional, visually memorable, and realistic enough to present as a startup/hackathon product.