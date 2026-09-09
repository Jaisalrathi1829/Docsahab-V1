I am redesigning the existing Docsahab Patient emergency medical assistance app.

IMPORTANT:
Do NOT redesign the application from scratch.
Do NOT change the existing brand identity.
Do NOT replace the current visual language unnecessarily.

Use the existing Patient App design as the primary visual reference and improve the current UI/UX while preserving its overall aesthetic.

Docsahab is an emergency medical assistance platform. The Patient App allows a patient to trigger an SOS, receive ambulance assignment information, and track the emergency response.

The existing design is clean, modern, minimal, healthcare-focused, with a white/light background, blue primary actions, rounded cards, large typography, and a prominent circular SOS button.

I want the following changes.

==================================================
1. REDESIGN THE SOS INTERACTION
==================================================

The current SOS button immediately triggers the emergency.

Change this behavior to a safer 3-second cancellation flow.

When the user taps the main SOS button:

1. Do NOT immediately submit the SOS API request.
2. Enter a 3-second emergency confirmation countdown.
3. Show a highly visible countdown:
   3 → 2 → 1
4. During the countdown, display a prominent "CANCEL SOS" button.
5. The user must be able to cancel the emergency during this countdown.
6. If the user presses "CANCEL SOS":
   - Stop the countdown.
   - Do not create/send the SOS.
   - Return to the normal home state.
7. If the countdown reaches zero:
   - Submit the actual SOS request.
   - Change the interface to the SOS SENT state.

The countdown must feel intentional and trustworthy rather than playful.

Suggested countdown UI:

"Emergency request starting"
"Sending SOS in 3"

with a prominent secondary/outlined action:

"CANCEL SOS"

Use subtle animation and clear visual feedback.

After countdown completion show:

"SOS SENT"

"Finding the nearest ambulance..."

Do not make the countdown excessively dramatic or alarming.

==================================================
2. SOS BUTTON STATES
==================================================

Create three clear visual states for the main SOS control.

STATE A — NORMAL

"TAP FOR"
"SOS"

"Connects you to a medic"

STATE B — COUNTDOWN

"EMERGENCY REQUEST"
"Sending SOS in 3"

"CANCEL SOS"

The number should update:
3 → 2 → 1

STATE C — SOS SENT

"✓"
"SOS SENT"

"Finding the nearest ambulance..."

Use the existing Docsahab blue visual identity.

Maintain accessibility:
- high contrast
- large touch target
- clear typography
- obvious state changes
- no confusing icons
- no tiny cancellation button

==================================================
3. SIMPLIFY EMERGENCY PROGRESS
==================================================

The current Emergency Progress section contains:

SOS sent
Ambulance assigned
Ambulance en route
Patient picked up
Arrived at hospital

For the Patient App, simplify this.

The Patient App's main progress tracker should stop at:

✓ SOS sent

✓ Ambulance assigned

Do NOT show:
- Ambulance en route
- Patient picked up
- Arrived at hospital

as primary progress steps on the Patient home screen.

Those are operational lifecycle stages handled by the ambulance/hospital applications.

After ambulance assignment, show a clear active emergency information card.

Example:

ACTIVE EMERGENCY

Ambulance assigned

DL-7B-AM-1101

ETA
6 min

"Your ambulance is on the way."

Add a secondary action:

"View emergency details →"

The UI should make it immediately obvious that the emergency request is active and that an ambulance has been assigned.

==================================================
4. REMOVE EMERGENCY CONTACTS FROM HOME
==================================================

Remove the "Emergency Contacts" card from the Patient home screen.

The current home screen should not contain an Emergency Contacts card directly below Emergency Profile.

Do not delete the Emergency Contacts functionality from the application.

Move Emergency Contacts into the patient's profile/emergency information area.

==================================================
5. MOVE EMERGENCY PROFILE TO TOP RIGHT
==================================================

The current header contains the patient's initials/avatar "AR" in the top-right.

Make this profile/avatar button the primary access point for:

- Patient profile
- Emergency medical profile
- Blood group
- Allergies
- Medical conditions
- Emergency contacts

When the user taps the avatar, open a polished profile/medical information screen or panel.

Example:

AR

Arjun Raghavan
34 • Male

Blood Group
O+

Allergies
Penicillin
Peanuts

Medical Conditions
Asthma
Hypertension

Emergency Contacts
3 contacts

Keep the main home screen uncluttered.

==================================================
6. IMPROVE THE HOME SCREEN INFORMATION HIERARCHY
==================================================

The new home screen should prioritize:

1. Patient identity
2. Current location status
3. SOS action
4. Current emergency state, if active
5. Emergency medical profile access

Do not overload the screen with secondary information.

Recommended hierarchy:

HEADER
Docsahab
Emergency medical assistance
[AR profile]

LOCATION
● Location active · Delhi NCR

GREETING
Hello, Arjun.
Professional help is one tap away.

PRIMARY ACTION
Large SOS button

SUPPORTING TRUST INFORMATION
Verified ambulances · 24×7 medical team

ACTIVE EMERGENCY CARD
Only visible when an emergency is active.

Do not show the Emergency Contacts card directly on the home page.

==================================================
7. ACTIVE EMERGENCY CARD
==================================================

When there is an active emergency, show a compact card below the SOS section.

Example:

ACTIVE EMERGENCY

✓ SOS sent
Ambulance assigned

DL-7B-AM-1101

Estimated arrival
6 min

"Your ambulance is on the way."

"View emergency details →"

The card should disappear when there is no active emergency.

Do not create fake data beyond the existing prototype data.

==================================================
8. PROFILE SCREEN
==================================================

Create/update the Patient Profile screen.

Include:

Profile header
- Avatar
- Patient name
- Age
- Sex

Medical Information
- Blood group
- Allergies
- Medical conditions

Emergency Contacts
- Contact name
- Relationship
- Phone number

The profile should feel like a healthcare/emergency profile, not a generic social media profile.

==================================================
9. VISUAL DESIGN
==================================================

Preserve the existing Docsahab visual identity.

Use:

- clean white/light background
- Docsahab blue as primary action color
- subtle light-blue surfaces
- rounded cards
- generous whitespace
- large readable typography
- healthcare-grade visual clarity
- minimal decorative elements
- strong visual hierarchy

Do not introduce unnecessary gradients, glassmorphism, excessive shadows, or flashy animations.

The product should feel:

Trustworthy
Calm
Fast
Professional
Medical
Emergency-ready

==================================================
10. MOBILE-FIRST
==================================================

This is a mobile emergency application.

Design for a modern smartphone viewport.

Ensure:

- SOS button is easy to reach
- all touch targets are large
- important information is visible without excessive scrolling
- countdown is readable
- cancellation action is obvious
- active emergency information is immediately visible
- profile access is easy from the top-right

==================================================
11. INTERACTION / PROTOTYPE BEHAVIOR
==================================================

Create functional prototype interactions for:

A. Tap SOS
→ Countdown begins

B. Countdown
→ 3 → 2 → 1

C. Tap CANCEL SOS
→ Countdown stops
→ Return to normal state

D. Countdown completes
→ SOS SENT state

E. SOS SENT
→ Show ambulance assignment state

F. Ambulance assigned
→ Show ambulance number and ETA

G. Tap profile avatar
→ Open patient medical profile

H. Tap View emergency details
→ Open emergency details/progress screen

==================================================
12. IMPORTANT PRODUCT LOGIC
==================================================

Do not invent a new emergency lifecycle.

The existing backend lifecycle is the source of truth.

The patient-facing UI should primarily expose:

SOS_TRIGGERED
AMBULANCE_ASSIGNED

The deeper operational statuses:

AMBULANCE_EN_ROUTE
PATIENT_PICKED_UP
SEVERITY_SELECTED
HOSPITAL_NOTIFIED
EN_ROUTE_TO_HOSPITAL
ARRIVED

belong primarily to the ambulance and hospital workflows.

The Patient UI should remain simple.

==================================================
13. OUTPUT
==================================================

Update the existing Patient App design rather than creating an unrelated concept.

Create polished screens for:

1. Patient Home — normal state
2. Patient Home — SOS countdown
3. Patient Home — SOS cancelled
4. Patient Home — SOS sent
5. Patient Home — ambulance assigned
6. Emergency Progress / Details
7. Patient Medical Profile

Keep all screens visually consistent.

Reuse components wherever possible.

Create reusable components for:

- SOS button
- Countdown state
- Active emergency card
- Profile avatar
- Medical information card
- Emergency status indicator
- ETA information

The final result should look like a production-quality emergency healthcare application suitable for a college project demonstration and future real-world development.

Before making major changes, inspect the attached existing screens and preserve their strongest visual elements.