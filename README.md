# Jarvis Core Interface

Create ONLY the FRONTEND UI for a futuristic J.A.R.V.I.S. personal AI assistant dashboard.

IMPORTANT:

I have attached a reference image. Treat that image as the PRIMARY visual reference.

I want the interface to look VERY CLOSE to the reference in terms of:

- overall composition

- dark futuristic HUD aesthetic

- central glowing JARVIS orb

- cyan/teal thin borders

- technical typography

- panel placement

- grid background

- subtle holographic effects

- sci-fi system-monitoring feel

Do NOT redesign this into a normal modern SaaS dashboard.

Do NOT make it look like a generic AI website.

Do NOT make it look like an AI-generated Dribbble dashboard.

The goal is:

"An actual futuristic computer interface that Tony Stark could realistically use."

==================================================

CORE REQUIREMENT — FRONTEND ONLY

==================================================

NO BACKEND.

NO DATABASE.

NO API.

NO AUTHENTICATION.

NO SUPABASE.

NO SERVER.

NO EXTERNAL AI API.

NO REAL DEVICE CONTROL.

NO REAL COMPUTER CONTROL.

NO REAL WEATHER API.

Everything must be frontend-only with realistic MOCK DATA.

However, interactions and animations MUST WORK in the browser.

Use React + TypeScript + Tailwind CSS.

Use reusable components and clean architecture so backend functionality can be added later.

==================================================

OVERALL VISUAL STYLE

==================================================

Use the uploaded reference image as the visual foundation.

Background:

- almost black

- deep navy

- extremely subtle blue/teal gradients

- subtle hexagonal texture

- subtle technical grid

- faint horizontal/vertical HUD lines

- tiny floating particles

- very subtle scanline effect

Primary accent:

CYAN / ELECTRIC TEAL

Use cyan carefully.

The UI should NOT be completely neon.

Most elements should be dark and low contrast.

Cyan should appear mainly around:

- active states

- borders

- important labels

- system indicators

- JARVIS core

- microphone

- selected navigation

Use thin 1px borders.

Use subtle outer glow.

Use glass-like dark translucent panels.

Avoid huge rounded cards.

Panels should have:

- small corner radius

- thin cyan border

- subtle inner highlight

- futuristic corner brackets

- occasional cut/angled corners

==================================================

SCREEN STRUCTURE

==================================================

Build a 16:9 desktop dashboard.

The entire screen should feel like one unified HUD.

Do NOT create excessive spacing between panels.

Use a precise grid.

--------------------------------------------------

TOP NAVIGATION

--------------------------------------------------

At the top create a futuristic horizontal navigation bar.

LEFT:

J.A.R.V.I.S.

Under/small beside it:

JUST A RATHER VERY INTELLIGENT SYSTEM

Use futuristic monospace/sci-fi typography.

CENTER:

HOME

DASHBOARD

SETTINGS

ABOUT

The active HOME item should have a subtle cyan underline/glow.

RIGHT:

SYSTEM STATUS

● SYSTEM ONLINE

Use small status indicators.

The navbar should resemble the reference image, NOT a conventional website navbar.

==================================================

LEFT SIDE

==================================================

Create three vertically stacked panels.

--------------------------------------------------

1. LOCATION

--------------------------------------------------

Panel title:

LOCATION

Show:

🇮🇳 Bengaluru

Karnataka, India

Underneath:

LAT 12.9716° N

LON 77.5946° E

Add a tiny abstract map/grid visualization.

Keep it subtle.

Panel should be compact.

--------------------------------------------------

2. SYSTEM STATUS

--------------------------------------------------

Panel title:

SYSTEM STATUS

Create four compact monitoring blocks:

BATTERY

61%

NETWORK

ONLINE

CONNECTION

4G

BLUETOOTH

READY

Use tiny futuristic icons.

Battery percentage should have a tiny progress indicator.

Network should show ONLINE in cyan/green.

Bluetooth should show READY.

--------------------------------------------------

3. ACTIVITY MONITOR

--------------------------------------------------

Panel title:

ACTIVITY MONITOR

Status:

● RESPONDING

Then a vertical terminal-like activity stream:

16:14:52 — RESPONDING

16:14:31 — LISTENING

16:14:21 — COMMAND RECEIVED

16:14:05 — PROCESSING

16:13:49 — LISTENING

16:13:34 — STANDBY

16:13:20 — DISCONNECTED

Use tiny monospace text.

Different states should have subtle accent colors.

==================================================

CENTER — MOST IMPORTANT

==================================================

The center of the interface should be dominated by the JARVIS AI CORE.

Do NOT make it a normal circle.

Create a sophisticated holographic orb.

The orb should contain:

- glowing cyan/teal sphere

- translucent inner layers

- subtle noise texture

- radial glow

- rotating rings

- thin orbital arcs

- tiny particles

- scanning lines

- small data points

- subtle distortion

- faint circular HUD markings

The core should look alive.

Use CSS/SVG/canvas-style frontend animation where appropriate.

Animation should be smooth and subtle.

When idle:

slow breathing/pulsing animation.

When listening:

orb becomes brighter and waveform appears.

When processing:

outer rings rotate faster.

When responding:

waveform animates.

Create a small status indicator above/below the core.

Example:

J.A.R.V.I.S. CORE

● ONLINE

--------------------------------------------------

JARVIS GREETING

--------------------------------------------------

Below the orb:

GOOD AFTERNOON, SIR.

Small subtitle:

AT YOUR SERVICE, SIR.

Then:

— J.A.R.V.I.S.

Typography should match the reference.

Keep it elegant.

==================================================

VOICE INTERFACE

==================================================

Near the bottom center create a circular microphone interface.

Large circular button.

Inside:

MICROPHONE ICON

Below:

TAP TO SPEAK

When clicked, simulate state changes:

IDLE

→ LISTENING

→ PROCESSING

→ RESPONDING

→ IDLE

No real microphone API is required.

Just simulate the experience visually.

Add a subtle audio waveform above/below the microphone.

==================================================

RIGHT SIDE

==================================================

Create two main futuristic panels.

--------------------------------------------------

1. SYSTEM INFO

--------------------------------------------------

Title:

SYSTEM-INFO

Show a large digital clock:

16:14:59

Below:

SUN. FEB 8

Weather:

☀ 30°C

CLEAR

Location:

Bengaluru

Then:

UPTIME

10h

COMMANDS

3

Use large digital typography for the clock.

Make this panel visually similar to the reference.

--------------------------------------------------

2. SYSTEM LOG

--------------------------------------------------

At the lower-right create:

SYSTEM_LOG // J.A.R.V.I.S.

Show a terminal command:

> USER> initialize lab security systems

Add blinking cursor.

Make it look like an actual system console.

==================================================

BACKGROUND

==================================================

Behind the UI:

Create a very subtle futuristic environment.

Include:

- faint perspective grid

- thin horizontal lines

- vertical technical lines

- tiny glowing points

- extremely subtle hex pattern

- faint holographic circles

- barely visible circuitry

Do NOT make the background busy.

The reference image has lots of empty dark space.

Preserve that feeling.

==================================================

HUD FRAME

==================================================

Add extremely thin cyan HUD framing around the entire viewport.

Use corner brackets:

TOP LEFT

TOP RIGHT

BOTTOM LEFT

BOTTOM RIGHT

Make them subtle.

Add tiny technical markers around the edges.

==================================================

TYPOGRAPHY

==================================================

Use:

Inter / Space Grotesk for normal text.

JetBrains Mono for:

- system logs

- coordinates

- percentages

- timestamps

- technical labels

Technical labels should use:

uppercase

small font

letter spacing

Example:

SYSTEM STATUS

not:

System Status

==================================================

ANIMATIONS

==================================================

Animations are VERY important.

Implement:

1. JARVIS orb breathing

2. orbital ring rotation

3. subtle particle movement

4. scanning line movement

5. microphone glow

6. waveform animation

7. blinking terminal cursor

8. status indicator pulse

9. panel hover effects

10. smooth navigation transitions

Keep animations sophisticated.

Do NOT make everything move.

The reference should feel like a sophisticated machine operating quietly.

==================================================

INTERACTIONS

==================================================

Even though this is frontend-only, make the UI interactive.

HOME:

show dashboard

DASHBOARD:

show same dashboard with expanded system information

SETTINGS:

show a futuristic settings interface

ABOUT:

show J.A.R.V.I.S. information

Microphone:

simulate voice interaction states

System panels:

hover effects

Navigation:

smooth active-state transitions

Clock:

use the browser's current time

Status:

use realistic mock data

==================================================

RESPONSIVE

==================================================

Primary target:

1920 × 1080

Also support:

1440 × 900

1366 × 768

1024 × 768

Do NOT let panels overlap.

At smaller widths, intelligently reduce panel sizes while preserving the central JARVIS core.

==================================================

DESIGN QUALITY

==================================================

This is extremely important.

The result should NOT look like:

- a Bootstrap dashboard

- a generic admin panel

- a SaaS template

- a gaming UI

- a cyberpunk website

- an AI-generated concept page

It should look like:

A REAL HIGH-END FUTURISTIC OPERATING SYSTEM.

Think:

Tony Stark's private computer interface

+

modern aerospace HUD

+

premium cinematic interface

+

real software usability

The interface should feel restrained, intelligent and expensive.

==================================================

FINAL RULE

==================================================

DO NOT add backend functionality.

DO NOT create API calls.

DO NOT create login.

DO NOT create database schemas.

DO NOT connect external services.

ONLY create the frontend experience.

Use mock data wherever necessary.

Prioritize visual fidelity to the attached reference image above everything else.

Make the first screen immediately impressive when opened.

The user should look at it and think:

"THIS IS JARVIS."

Not:

"This is an AI dashboard."

Build the entire frontend now.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4a35b126-7a3c-4b1a-889e-3464f65d91c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
