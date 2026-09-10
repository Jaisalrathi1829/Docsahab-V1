UPGRADE THE EXISTING DESIGN — DO NOT CREATE A NEW APP FROM SCRATCH.

Transform the current “Hospital Emergency Console” into a SINGLE-PAGE EMERGENCY PATIENT MONITORING DASHBOARD.

IMPORTANT UX RULE:
In an emergency, the doctor/nurse must NOT have to click between Overview, Vitals, Medical History, Alerts, etc. EVERYTHING IMPORTANT MUST BE VISIBLE ON ONE SCREEN. Remove unnecessary navigation tabs and separate sections. Create one highly focused emergency dashboard.

Keep the existing visual identity:
- Clean modern hospital/medical SaaS interface
- White/light background
- Blue as the primary UI color
- Red/orange only for emergency severity and warnings
- Rounded cards
- Thin subtle borders
- Soft shadows
- Professional typography
- Compact spacing
- Desktop hospital workstation layout
- High information density without looking cluttered

DO NOT make it look like a consumer health app.
It should look like a professional emergency-room command console.

==================================================
NEW SCREEN STRUCTURE
==================================================

HEADER
Create a compact top header:

Left:
- Docsahab / Hospital Console logo
- “St. Vincent Medical Center · Emergency Wing”

Center/right:
- “ER Capacity: 8/12 beds”
- “Trauma Bay: Available”
- “ICU: 3 open”

Right:
- Green “● LIVE MONITORING” indicator
- Current time
- Notification icon
- Settings
- User avatar

Remove unnecessary navigation tabs.

==================================================
PATIENT HEADER
==================================================

Immediately below the header, create ONE prominent patient information area.

Left:
- CRITICAL SEVERITY badge in red
- Patient name: “Rahul Sharma”
- Patient ID
- Age
- Gender
- Arrival time
- Ambulance number

Next to it:
Large status:
“CRITICAL”
“Condition requires immediate attention”

Also show:
- ETA
- Assigned trauma team
- Bed status

Make the severity extremely obvious but not visually overwhelming.

==================================================
TOP PRIORITY ROW
==================================================

Below the patient header, create 3 compact cards across the width:

1. CURRENT CONDITION
   - “Condition deteriorating”
   - Small trend indicator
   - “Rapid change detected”

2. LIVE ALERTS
   - Critical alert count
   - Most important active alert
   - Example:
     “Severe deterioration detected”
     “Immediate physician attention”

3. RESPONSE STATUS
   - Response timer
   - Team notified
   - Trauma team ready

These cards should fit perfectly in one horizontal row.

==================================================
LIVE MONITORING
==================================================

Create ONE large central card titled:

“LIVE PATIENT MONITORING”
Status badge:
“● STREAMING”

DO NOT display basic vitals as four giant separate cards.

Instead, show meaningful clinical monitoring in a compact dashboard.

Include:

CARDIAC ACTIVITY
- Live ECG waveform
- Cardiac status: “Abnormal”
- Small trend indicator

RESPIRATORY STATUS
- Respiratory status: “Compromised”
- Trend: worsening
- Simple waveform/visual indicator

NEUROLOGICAL STATUS
- Consciousness: “Responsive”
- Status indicator

CIRCULATION
- Circulatory status: “Unstable”
- Trend indicator

The ECG/waveform should be visually prominent because it represents LIVE monitoring.

Do NOT make heart rate, blood pressure, SpO2 and temperature the main focus.
The system is intended to communicate the patient's overall emergency condition rather than overwhelm the responder with raw numbers.

==================================================
MEDICAL RISK + ALERTS
==================================================

Create a horizontal section beneath live monitoring.

LEFT CARD:
“CRITICAL MEDICAL RISKS”

Show:
- Severe allergy: Penicillin
- Previous major condition: Prior MI
- Current risk: Hypertension
- Overall risk: HIGH

Use compact chips/badges rather than large blocks.

RIGHT CARD:
“ACTIVE ALERTS”

Show only the most important alerts:
🔴 Severe deterioration detected
🟠 Respiratory compromise
🟡 Physician review recommended

Each alert should have severity, short description and timestamp.

==================================================
BOTTOM SECTION
==================================================

Create three compact cards:

1. RISK ASSESSMENT
   - Cardiac: HIGH
   - Respiratory: HIGH
   - Neurological: LOW
   - Overall: HIGH

2. RECENT EVENTS
   - 16:32 Condition worsened
   - 16:28 Critical alert triggered
   - 16:24 Ambulance telemetry connected

3. EMERGENCY ACTIONS
   Large clear buttons:
   - CALL DOCTOR
   - NOTIFY TRAUMA TEAM
   - OPEN PATIENT RECORD
   - EMERGENCY PROTOCOL

The “CALL DOCTOR” and most urgent action should be visually dominant.

==================================================
LAYOUT RULES
==================================================

VERY IMPORTANT:

Everything must fit into ONE desktop viewport without requiring the user to navigate to another page.

Use a responsive 12-column grid.

Suggested structure:

Header
↓
Patient + Critical Status
↓
3 Priority Cards
↓
Large Live Monitoring Card
↓
Medical Risks + Active Alerts
↓
Risk Assessment + Recent Events + Emergency Actions

Cards should have consistent heights, padding, alignment and spacing.

Do not create oversized empty areas.

Do not create unnecessary cards.

Do not create separate pages.

Do not create separate tabs for:
- Overview
- Vitals
- Medical History
- Alerts
- Monitoring

All of these must be integrated into this single dashboard.

==================================================
VISUAL HIERARCHY
==================================================

The visual priority must be:

1. CRITICAL PATIENT STATUS
2. CURRENT CONDITION
3. ACTIVE EMERGENCY ALERTS
4. LIVE MONITORING
5. MEDICAL RISKS
6. RISK ASSESSMENT
7. RECENT EVENTS
8. EMERGENCY ACTIONS

A doctor should understand the patient's situation within 5–10 seconds.

Use:
- Red = critical/emergency
- Orange = warning
- Blue = monitoring/information
- Green = stable/ready/connected
- Neutral gray = secondary information

Keep colors restrained and professional.

==================================================
IMPORTANT DESIGN CORRECTIONS FROM CURRENT VERSION
==================================================

Remove the current left-side “Incoming Requests” queue from the patient monitoring screen.

Remove the right-side “Decision / Accepted Cases” panel.

Those are useful for an emergency intake/triage screen but NOT for the detailed monitoring screen.

The new screen should dedicate almost the entire available width to ONE selected emergency patient.

Do not show duplicated information.

Do not use excessive text.

Do not make every piece of information a separate card.

Use clear grouping and hierarchy.

Make the dashboard feel like a real emergency-room workstation where every important piece of information is visible immediately.

FINAL RESULT:
A clean, professional, single-screen emergency patient monitoring dashboard with excellent card fitting, strong hierarchy, live monitoring, critical alerts, risk assessment and emergency actions — all visible without clicking into different sections.