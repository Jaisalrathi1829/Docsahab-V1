Design a hospital emergency dashboard web app called "Docsahab" (Hospital Console) for St. Vincent Medical Center, Emergency Wing. Desktop layout, 1536px wide, clean modern SaaS style, white background, rounded corners (8-12px), soft shadows, sans-serif font (Inter or similar).

LEFT SIDEBAR (dark navy #0F172A, ~210px wide, full height):
- Top: circular teal/green gradient logo icon with plus symbol, "Docsahab" bold white text, "Hospital Console" small gray subtext below
- Nav items with icons, white text on active state (Dashboard highlighted with lighter background), gray text for inactive: Dashboard, Emergency Queue (with red "3" badge), Patients, Resources, Communication, History
- Bottom section: small status card "All systems operational" with green dot, "Live data connected" with small waveform icon
- Below that: user profile row with circular avatar "DR", "Dr. Sharma" bold white, "Emergency Staff" small gray subtext, chevron dropdown
- Bottom: Settings and Log out links with icons

TOP HEADER BAR (white, full width, border-bottom):
- Left: circular blue icon, "St. Vincent Medical Center" bold black heading, "Emergency Wing" gray subtext with location pin icon
- Center-right: three pill-shaped stat cards with icons: "ER Beds 8/12", "ICU 3/5", "Trauma Bay Ready" (green text)
- Right: green pill badge "Online · Accepting" with dot, bell icon with red "2" badge, circular avatar "DR", date/time "Wed, 9 Sep 2025 3:14 PM"

MAIN CONTENT AREA (3-column grid below header):

COLUMN 1 (Emergency Queue, ~300px):
- Header "Emergency Queue" with red "3" badge count, "Sort" dropdown
- List of 5 stacked cards, each with: numbered badge (01-05), colored priority pill (CRITICAL=red, HIGH=orange, MODERATE=yellow, LOW=blue), ETA time top-right, bold case title (e.g. "Cardiac Emergency"), ambulance number + distance with icons, small warning banner with orange/red text and warning icon for critical notes, chevron arrow right
- First card highlighted with red/pink tinted background border
- "View all emergencies" link with arrow at bottom

COLUMN 2 (Main detail panel, widest, center):
- Red "CRITICAL" tag pill at top
- Large heading "Cardiac Emergency" with heartbeat icon
- Row of meta info: ambulance icon + "Ambulance #204", location pin + "2.8 km", clock icon + "ETA 4 min"
- Inline warning chips: "Penicillin allergy", "Prior MI", "Hypertension" in red pill badges
- Right-aligned countdown card (light red/pink background): clock icon, "Arriving in", huge "04:12" timer, thin progress bar underneath
- Horizontal tab bar: Overview (active, blue underline), Vitals, Medical History, Timeline, Ambulance
- Patient info card: circular avatar placeholder, "Rajesh Kumar" bold, "42 years · Male", "Patient ID: P-45872", right side two columns "Blood Group B+" and "Allergies Penicillin", plus "Prior MI, Hypertension" conditions
- "Live Monitoring" card with green "Live" pulsing dot badge: three sub-panels showing ECG waveform (green squiggly line) "Normal Sinus Rhythm", Respiratory Rate "22/min Normal", Oxygen Saturation "93% Low" (orange text)
- Link "View full vitals & trends" with arrow
- "Patient Status" card with horizontal timeline/stepper: 4 circular icon nodes connected by lines — SOS Triggered 14:02, Ambulance Assigned 14:03, Patient Picked 14:09, Severity Updated 14:11, Hospital Acceptance Req. 14:14 (last node red/highlighted)
- "View full timeline" link with arrow

COLUMN 3 (Right sidebar, ~300px):
- "Hospital Readiness" card: large circular progress ring "5/5" in center, "READY FOR ARRIVAL" bold, "All critical resources are available" gray subtext, list below with icons and green checkmarks: Emergency Bed (Assigned), Cardiologist (Assigned), ICU (Available), Cath Lab (Ready), Nursing Team (Notified)
- "Preparation Checklist" card with "5/5" badge: checklist items each with green checkmark circle: Emergency Bed Assigned, Cardiologist Assigned, ICU Bed Available, Cath Lab Ready, Nursing Team Notified
- "Hospital Decision" card (light yellow/cream background): lightning bolt icon, "Respond within 00:37" countdown, two full-width buttons stacked: green solid "Accept & Prepare" with checkmark icon, outlined red "Cannot Accept" with X icon

BOTTOM STICKY BAR (dark navy, full width):
- Left: circular red icon with heartbeat, "Cardiac Emergency" bold white, "Arriving in 04:12 · Ambulance #204 · 2.8 km" gray subtext
- Center: "Hospital Readiness 5/5" with green progress bar
- Center-right: two dark pill buttons with icons "Call Ambulance", "Message EMS"
- Right: "Faster coordination. Better outcomes." tagline with small waveform icon

COLOR PALETTE:
- Sidebar: dark navy #0F172A / #1E293B
- Background: light gray #F8FAFC
- Cards: white with subtle border #E2E8F0
- Critical/red: #DC2626, light red bg #FEE2E2
- Warning/orange: #F97316, light bg #FFEDD5
- Success/green: #16A34A, light bg #DCFCE7
- Info/blue: #2563EB, light bg #DBEAFE
- Text: dark gray #0F172A primary, #64748B secondary

Use rounded pill badges for status labels, card shadows (subtle, low elevation), consistent 16-20px padding inside cards, and icon library similar to Lucide/Feather icons throughout.