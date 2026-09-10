Design a hospital emergency dashboard web app called "Docsahab" (Hospital Console) for St. Vincent Medical Center, Emergency Wing. Desktop layout, 1536px wide x 900px tall viewport (must fit without horizontal scroll; vertical scroll allowed only within the center panel, not on the whole page). Clean modern SaaS style, white/light-gray background, rounded corners (8-12px), soft low-elevation shadows, sans-serif font (Inter or similar), generous but efficient spacing — no cramped or overlapping elements, no card content getting cut off.

CRITICAL STRUCTURAL RULE: Do NOT use tabs (no "Overview / Vitals / Medical History / Timeline / Ambulance" tab bar). This is an emergency-response screen — a clinician must see everything without clicking. Instead, stack all of that information vertically in one continuous scrollable panel, in this priority order top to bottom:
1. Patient identity + allergy/condition risk chips (always visible, no scroll needed)
2. Live vitals (large, instrument-panel style numbers)
3. Critical alerts (allergy + condition warnings, consolidated — do not repeat allergy info in multiple places)
4. Ambulance + transport details (compact single row, not a separate full card)
5. Patient status timeline (horizontal stepper, compact)
6. Medical history (collapsed/expandable accordion — collapsed by default except the most relevant item — so it doesn't add scroll length, but is not hidden behind a tab click)

LEFT SIDEBAR (dark navy #0F172A, fixed 72px wide when an active emergency is on screen — ICON-ONLY, no text labels, to save horizontal space for content): circular logo icon at top, stacked nav icons with a small red dot badge on the Emergency Queue icon, user avatar circle at the bottom. Full-width labeled sidebar (210px) only appears on non-emergency screens — do not use it here, it's part of the crowding problem.

TOP HEADER BAR (white, full width, fixed height 60px, border-bottom):
- Left: small circular blue icon, "St. Vincent Medical Center" bold, "Emergency Wing" gray subtext
- Center: compact stat pills only (ER Beds 8/12, ICU 3/5, Trauma Bay Ready) — keep these small, single line, no wasted padding
- Right: green "Online · Accepting" pill, bell icon with badge, avatar — do not include date/time text here, it's non-essential and crowds the bar

EMERGENCY COMMAND BAR (directly below header, full width, red background #DC2626, sticky, one clear row — this replaces the separate "CRITICAL" tag + countdown card + queue card that were fighting for attention before):
- Left: pulsing white dot, "Incoming — Cardiac Emergency" bold white, "Ambulance #204 · 2.8 km · penicillin allergy, prior MI, hypertension" as one compact subtext line (consolidate risk chips into this line instead of repeating them elsewhere)
- Center: large countdown "04:12" white bold, tabular numerals
- Right: two buttons only — white solid "Accept & Prepare", outlined "Cannot Accept". Keep this bar to a single row height (~64px), never wrap to two lines — shorten text if needed to fit at 1536px width

BELOW THE COMMAND BAR — two-column layout only (drop the third "queue" column from this main screen; move the queue of other incoming cases to a separate collapsible drawer or a link "View 4 other incoming cases →" so this screen stays focused on the one active emergency):

LEFT/MAIN COLUMN (roughly 65% width):
- Patient identity row: avatar circle, "Rajesh Kumar, 42, Male, P-45872, B+" all on one line, right-aligned ambulance driver name — keep to single row, do not let text wrap awkwardly
- Vitals panel: 4 large stat blocks in one row (Heart Rate, Blood Pressure, SpO2, Temperature), each with number sized ~28-32px, label above, color-coded only when abnormal (red for critical, amber for caution, green/neutral for normal) — equal-width columns using CSS grid so none overflow, with vertical divider lines between them instead of separate bordered boxes
- Compact status timeline: horizontal stepper with 4-5 small nodes and short labels/timestamps, sized to fit one row without wrapping
- Medical history accordion: 2-3 collapsible rows (Medical History, Medications & Allergies, Timeline detail) — first one expanded by default, rest collapsed, each row max one line when collapsed

RIGHT COLUMN (roughly 35% width):
- Hospital Readiness checklist: compact list, icon + label + status, 6-7 rows max, each row single line height ~32px so the whole list fits without scrolling
- Thin progress bar + "6/7 ready" caption
- Two small outlined buttons side by side at the bottom: "Call Ambulance", "Message Team"
- Keep this entire right column height-matched to the left column — do not let it run shorter or longer, use consistent row heights and padding so both columns end at the same vertical point

SPACING & FIT RULES (to fix the "cards don't fit" problem):
- Use a strict 12-column responsive grid with consistent 20px gutters
- All cards use the same internal padding (16-20px) — no card should have noticeably more whitespace than another
- No card should require its content to shrink below 12px font size to fit
- Test that all text fits on one line where a single line is intended — if it doesn't, shorten the label instead of wrapping or overflowing
- Avoid stacking more than 3 nested bordered containers in one column — use dividers/whitespace instead of boxes within boxes
- Total page height should fit within 900px without needing to scroll the whole page; only the accordion/history section may cause internal scroll if expanded

COLOR PALETTE:
- Sidebar: dark navy #0F172A
- Background: light gray #F8FAFC
- Cards: white, border #E2E8F0
- Critical/red: #DC2626, light bg #FEE2E2 — reserve saturated red ONLY for the command bar and truly abnormal vitals, not decorative badges elsewhere
- Warning/amber: #D97706, light bg #FEF3C7
- Success/green: #16A34A, light bg #DCFCE7
- Text: #0F172A primary, #64748B secondary

Icons: Lucide/Feather style, 16-20px, consistent stroke weight throughout.