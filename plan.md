Project: ProPresenter Web (Next.js 16 + Convex) - Present should be the name
1. Project Architecture & Stack
Framework: Next.js 16 (App Router, React 19 Server Components)

Backend & Database: Convex (Real-time DB, Functions, File Storage)

Styling: Tailwind CSS v4 (using CSS variables for Theme configuration)

AI: Vercel AI Gateway (OpenAI via Vercel Gateway API)

Language: TypeScript (Strict mode)

State Sync: Convex Live Queries (No manual WebSockets needed)

1. Core Philosophy
Desktop-First UI: The app should not feel like a website. No page reloads. Dense information density. Resizable panes.

Multi-Window Output: The "Controller" runs in one window, the "Projector/Output" runs in a separate window. They stay in sync via BroadcastChannel (local) and Convex (remote).

Real-Time Collaboration: If User A clicks "Slide 1", User B sees "Slide 1" highlight immediately.

PHASE 1: The Foundation & Real-Time Engine (MVP Core)
Goal: A working app where multiple users can log in, create a playlist, and control a slide that updates on a second window instantly.

Setup & Auth

Initialize Next.js 16 with Tailwind v4.

Initialize Convex.

Implement Authentication (Convex Auth or Clerk) to support multiple users under one "Organization" (User Req #3).

Database Schema (Convex)

presentations: Stores songs/slides.

playlists: Ordered list of presentations.

state: Global state for the active slide (current_slide_id, is_clear_to_logo, etc.).

The Controller Layout (Desktop UI)

Create a "Holy Grail" layout: Left Sidebar (Library), Center Top (Preview), Center Bottom (Slide Grid), Right Sidebar (Playlist).

Implement Dark/Light mode toggle using Tailwind v4 CSS variables.

The Output Window

Create a route /output.

Use BroadcastChannel API for zero-latency local control.

Use Convex subscriptions as a fallback for remote control.

PHASE 2: Advanced Lyric Management (User Req #1 & #2)
Goal: Smart text parsing and AI cleaning.

Smart Parsing (User Req #2)

Build a parser that detects text inside [] brackets (e.g., [Chorus], [Verse 1]).

UI Logic: Render these tags as small "badges" in the Controller View.

Output Logic: Strip these tags completely from the Projector/Output View.

AI Lyric Fixer (User Req #1)

Create a Convex Action fixLyricsAction.

Integrate Vercel AI Gateway.

Prompt Engineering: "You are a worship lyric editor. Correct spelling, fix casing for deity (God vs god), and remove non-lyrical metadata. Context: 'King of kings' (second king is lower). Return JSON."

Add a "Magic Wand" button in the slide editor to trigger this.

PHASE 3: The "Pro" Presentation Features
Goal: Match the essential ProPresenter feature set defined in the prompt.

Slide Management

Reflow Editor: A text area where splitting a paragraph automatically creates new slides.

Groups: Color-code slides based on Verse/Chorus groups.

Media Layer & Backgrounds

Implement the "Layer System" (Background Z-Index 0, Text Z-Index 10).

Video Backgrounds: Use next-video or standard <video> tag with object-fit cover.

Convex Storage: Allow users to upload Motion Backgrounds to the cloud.

Stage Display (Confidence Monitor)

Create a route /stage-display.

Show "Current Slide" (Big) and "Next Slide" (Small).

Show the "Verse/Chorus" tags here (unlike the main output).

PHASE 4: Optimization & Polish
Offline Support: Implement minimal Service Workers to cache assets.

Hotkeys: Add keyboard listeners (Right Arrow = Next, F1 = Clear All).

Detailed Tech Specs for Cursor
Data Model (Convex schema.ts)
TypeScript

// Proposed Schema Structure
export default defineSchema({
  organizations: defineTable({ name: v.string(), ... }),
  users: defineTable({ email: v.string(), orgId: v.id("organizations"), ... }),
  
  // The content
  songs: defineTable({
    title: v.string(),
    lyrics: v.string(), // Raw text
    slides: v.array(v.object({
        text: v.string(),
        label: v.string(), // e.g. "Verse 1"
        backgroundId: v.optional(v.id("media")),
    }))
  }),

  // The Active State (Syncing)
  playbackState: defineTable({
    orgId: v.id("organizations"),
    activeSlideId: v.optional(v.string()),
    activeBackgroundId: v.optional(v.string()),
    isBlackedOut: v.boolean(),
  }).index("by_org", ["orgId"]),
});
UI Components (Tailwind v4)
Grid View: Use grid-cols-[repeat(auto-fill,minmax(200px,1fr))] for the slide browser.

Text Scaling: Use text-wrap and dynamic font sizing logic for the Output view.

AI Implementation (Vercel AI SDK Core)
Use generateObject for type-safe lyric correction returns.

Model: gpt-4o-mini or claude-3-haiku for speed.

How to Start (Prompt for Cursor)
To begin, copy and paste this into Cursor's chat:

"I want to build a ProPresenter web clone. I have a plan.md file in the root. Please read it. Let's start with Phase 1: Foundation. Initialize a Next.js 16 app with Convex and Tailwind v4. Set up the Convex Auth for multi-user support so we can have a workspace where multiple users can log in. Do not build the UI yet, just the skeleton and auth."