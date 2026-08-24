"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Shield, Layers, Code2, FileSignature, Newspaper } from "lucide-react";

type Item = { label: string; desc?: string };
type Block = { heading: string; items: Item[] };
type AppDoc = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  blocks: Block[];
};

const DOCS: AppDoc[] = [
  {
    id: "portal",
    title: "Portal",
    subtitle: "Euromedica Group's centralized management platform",
    icon: <Layers className="w-5 h-5" />,
    accent: "text-blue-600",
    accentBg: "bg-blue-50 border-blue-100",
    blocks: [
      {
        heading: "Business Function",
        items: [
          {
            label: "Identity & Access Hub",
            desc: "Portal acts as the single source of truth for employee identity and access rights across all of Euromedica Group's internal applications. Every employee has one account linked to their HR data in Talenta.",
          },
          {
            label: "SSO Orchestration",
            desc: "External applications (LMS, attendance, etc.) don't manage their own passwords — they delegate authentication to Portal via App Token JWT. Portal is the sole identity provider.",
          },
          {
            label: "Role & Module Governance",
            desc: "Admins control who can access which features through a combination of Role and Module. Access changes take effect in real time without requiring a redeployment.",
          },
        ],
      },
      {
        heading: "User Management",
        items: [
          { label: "Talenta Sync", desc: "Employee data (name, position, branch, organization, avatar) is synced from Talenta HRIS either manually or on a scheduled cron job using the X-Sync-Secret header." },
          { label: "Active / Inactive Status", desc: "Inactive users cannot log in to the portal or any SSO application. Employees who have resigned (resignDate ≤ today) are automatically blocked from SSO." },
          { label: "Account Activation", desc: "New users activate their account via an email link (single-use, expiring token). The activation button is shown in orange. After successful activation, the user is redirected to the login page." },
          { label: "Forgot & Reset Password", desc: "Users can request a password reset via their NIK — the system sends a link to their registered email. The token is one-time use with an expiry, and is invalidated immediately after use. An error message is shown if the NIK is not found or the email is empty." },
          { label: "Assign Role", desc: "A user can hold one role per scope (portal = appId null, or per application = a specific appId). A unique constraint prevents duplicate roles within the same scope." },
          { label: "Default Role", desc: "A role can be flagged as default with a scope of ALL / ORGANIZATION / POSITION / BRANCH / or a combination. During a Talenta sync, users who don't yet have a role in that scope are automatically assigned one." },
          { label: "Bulk Assign & Remove Role", desc: "Admins can select multiple users at once to assign or remove a given role. Removing a role only removes the selected roleId, not all of the user's roles." },
        ],
      },
      {
        heading: "Portal Dashboard",
        items: [
          { label: "Responsive Two-Zone Layout", desc: "The dashboard uses a flex-col layout on mobile and flex-row on desktop. The main area holds a compact app-card grid; the right sidebar holds the Euro Update widget. On mobile, the widget appears below the grid, stacked vertically." },
          { label: "Compact App Card + Tooltip", desc: "App cards in the portal grid are shown in compact mode — a small icon plus name. On hover, a tooltip bubble with the app's description appears. The tooltip uses pure CSS group-hover, no JS." },
          { label: "EU Widget in Sidebar", desc: "If the user has access to Euro Update, the portal sidebar shows three cards: Today's Birthdays, Upcoming Events, and the latest Announcements. Each has a 'View all' link to the EU app." },
          { label: "Latest Feed Preview", desc: "Below the app grid, the latest Euro Update feed is shown: title, a 180-character excerpt, thumbnail, colored category pill, and reaction & comment counts." },
          { label: "EuLink — Close Sidebar", desc: "Every link to Euro Update on the portal dashboard uses the EuLink component (a client component). When clicked, EuLink dispatches a closeSidebar event so the portal's navigation sidebar automatically closes." },
          { label: "Conditional EU Block", desc: "The entire EU block (sidebar widget + feed preview) is only rendered if the user has access to the Euro Update module. Users without access see the normal full-width app grid. The EU query is wrapped in try/catch — if it fails, the dashboard still renders normally without EU data." },
        ],
      },
      {
        heading: "Role & Module Management",
        items: [
          { label: "Role", desc: "An entity that groups access rights. A role has a list of modules it can access. Roles can be locked to prevent accidental changes." },
          { label: "Module", desc: "Represents a menu / feature within the application. Has a path (URL), icon, color, group, and display order in the sidebar. Type is either 'module' (portal page) or 'app' (external application via SSO)." },
          { label: "Assign Module to Role", desc: "Admins choose which modules a given role can access. Changes take effect immediately on the next login session." },
        ],
      },
      {
        heading: "SSO (Single Sign-On)",
        items: [
          { label: "App Token", desc: "Every external application receives an App Token (JWT) generated from Portal. The token carries permission flags: LOGIN and/or VALIDATE." },
          { label: "External Login Flow (Direct)", desc: "The external app POSTs to /api/sso/login with an X-App-Token header and a body of {employeeId, password}. Portal validates the credentials and returns a 24-hour session token." },
          { label: "Login via Portal Flow (Redirect)", desc: "The user is already logged in to Portal and clicks an external app's card → Portal POSTs to /api/sso/generate-link → gets back a redirect URL with an sso_token (single-use, 5 minutes). The external app calls GET /api/sso/validate?sso_token=... to exchange it for a session token." },
          { label: "Validate Session", desc: "GET /api/sso/validate with Authorization: Bearer {session_token} to verify an active session. Returns full user data, including the roles the user holds in that application." },
          { label: "Revocation", desc: "An App Token can be revoked from Portal at any time. Session tokens are invalidated on a new login (deleteMany on old sessions per user per app)." },
        ],
      },
      {
        heading: "Infrastructure & ENV Mode",
        items: [
          { label: "DEVELOPMENT", desc: "An orange banner appears above the navbar. Developer Docs appears in the sidebar. All operations run normally." },
          { label: "REPLICA", desc: "A violet banner. Middleware blocks all writes (POST/PATCH/PUT/DELETE) except login endpoints: /api/auth/, /api/sso/login, /api/sso/validate, /api/sso/generate-link. Status 423 is returned for blocked operations." },
          { label: "PRODUCTION", desc: "No banner. All operations run normally. This is the default value when ENV_MODE is unset or empty." },
          { label: "Branch & Position Sync", desc: "The /api/talenta/sync-branch and /api/talenta/sync-job-position endpoints can be called via cron using the X-Sync-Secret header. Old data is never deleted (upsert only) to preserve referential integrity." },
        ],
      },
      {
        heading: "Notification System",
        items: [
          { label: "In-App & Email", desc: "Every important action (approval, PIC assignment, UAT, revision, etc.) triggers an in-app and/or email notification depending on the configuration in System Settings. Both can be enabled/disabled independently." },
          { label: "Real-Time via SSE", desc: "Portal uses Server-Sent Events (SSE) — a persistent connection to /api/notifications/stream. Notifications appear on the bell icon without a page refresh. The in-memory emitter is singleton-based and safe for single-instance Docker deployments." },
          { label: "Polling Fallback", desc: "Besides SSE, the bell icon still polls the count every 60 seconds as a fallback in case the SSE connection drops." },
          { label: "Direct Link to Source", desc: "Every notification stores a refUrl — a direct URL to the relevant page (e.g. an SD request detail or an SSD letter). It's built automatically when the notification is created via a Module table lookup, so the caller never has to supply it manually." },
          { label: "Auto Page Refresh", desc: "The 'Open Detail' button appends a ?_r=timestamp param to the URL. The destination page detects the param change via useNotifRefresh(load) and re-fetches its data — avoiding a stale view if the user is already on that same page." },
          { label: "Notification Management", desc: "Users can mark all as read, delete notifications that have been read, and navigate with pagination on the /notifications page. The bell icon shows an unread-count badge." },
        ],
      },
      {
        heading: "Security",
        items: [
          { label: "Portal Authentication", desc: "NextAuth with database sessions — tokens are stored in the Session table and can be revoked at any time. Not a stateless JWT, which can't be invalidated before it expires." },
          { label: "Page Authorization", desc: "Server-side in (pages)/layout.tsx: reads x-pathname from the middleware header and compares it against the user's list of modules. Redirects to / if access is missing — cannot be bypassed by direct URL access." },
          { label: "API Authorization", desc: "Every portal route (/api/user/, /api/role/, /api/module/, etc.) is protected by requireSession(). Returns 401 without a valid session. SSO routes have their own authentication via X-App-Token." },
          { label: "Password", desc: "bcrypt with the default salt rounds — plaintext is never stored or logged." },
          { label: "Password Reset", desc: "A single-use token with an expiry. Once used, the token is invalidated immediately." },
          { label: "Sensitive Data Encryption", desc: "AES-256-GCM via ENCRYPTION_KEY for data that needs to be encrypted in the database." },
        ],
      },
    ],
  },
  {
    id: "sd",
    title: "Software Development",
    subtitle: "Submission and tracking system for internal software development requests",
    icon: <Code2 className="w-5 h-5" />,
    accent: "text-indigo-600",
    accentBg: "bg-indigo-50 border-indigo-100",
    blocks: [
      {
        heading: "Business Function",
        items: [
          {
            label: "Digitizing the SD Process",
            desc: "Replaces manual submission (email/chat) for internal software development requests. Every request has a clear lifecycle, a full audit trail, and real-time status visibility for all parties.",
          },
          {
            label: "IT & User Collaboration",
            desc: "The IT team and requesters collaborate on a single platform: the requester creates the request, IT reviews it and produces a technical document, the user approves it, IT does the work, the user tests it (UAT), and finally approves it for deployment.",
          },
        ],
      },
      {
        heading: "Full Status Flow",
        items: [
          { label: "DRAFT", desc: "Request created by the requester. Editable. Not yet in the IT queue." },
          { label: "SUBMITTED", desc: "The requester submits the request. IT receives a notification to begin review." },
          { label: "IT_REVIEW", desc: "The IT team is analyzing the request, estimating time and cost, and preparing technical documentation." },
          { label: "APPROVED_IT", desc: "IT has finished the review and produced an IT Document (technical specification, estimate). The requester needs to review and approve this document." },
          { label: "APPROVED_USER", desc: "The requester approves the IT Document. Work can officially begin." },
          { label: "IN_PROGRESS", desc: "The IT team is working on it. IT can update progress (percentage) periodically. Notifications are sent to the requester." },
          { label: "UAT", desc: "The feature is ready for testing. The requester enters User Acceptance Testing mode." },
          { label: "UAT_REVISION", desc: "The requester finds a bug or discrepancy and provides revision notes. Returns to work (IN_PROGRESS)." },
          { label: "DONE", desc: "The requester approves the UAT result. The request is complete and archived." },
          { label: "REJECTED / CANCELLED", desc: "Can happen from any status. REJECTED by IT or an approver, CANCELLED by the requester." },
        ],
      },
      {
        heading: "Features",
        items: [
          { label: "Request Management", desc: "Create a request with a title, description, type (New Feature / Enhancement / Bug Fix / etc.), and a reference to the related application. Auto-generates a request number: SD-YYYY-NNN." },
          { label: "IT Document", desc: "The IT team produces a technical document containing analysis, implementation specification, and time/resource estimates. This document must be approved by the requester before work begins." },
          { label: "Approval Workflow", desc: "A multi-step approval template that admins can configure. Each step can be assigned to a specific user, position, or department." },
          { label: "UAT Module", desc: "The requester tests directly from the platform. Can approve (DONE) or request a revision with detailed notes for the IT team." },
          { label: "Progress Tracking", desc: "The IT team updates the work-progress percentage. The requester can monitor progress in real time." },
          { label: "Attachments", desc: "Upload supporting files (bug screenshots, wireframes, reference documents) per request. Stored locally on the server." },
          { label: "Environment Info", desc: "Notes on server configuration, environment variables, or other technical details relevant to deployment." },
          { label: "Dashboard & Statistics", desc: "A summary of total requests, in-progress, completed, and a list of recent requests along with their status." },
        ],
      },
      {
        heading: "Security",
        items: [
          { label: "Session Required", desc: "Every /api/sd/* endpoint is protected by a NextAuth session. Returns 401 if unauthenticated." },
          { label: "Approver Validation", desc: "An approval action is validated to confirm the acting user is the approver designated for that step. No approving on someone else's behalf." },
          { label: "Local File Storage", desc: "Attachments are stored in a local directory on the server (/uploads/), not on a public cloud. File access goes through /api/files/, which is also session-protected." },
        ],
      },
    ],
  },
  {
    id: "ssd",
    title: "SSD — Digital Letters",
    subtitle: "System for creating, approving, and archiving the company's official digital letters",
    icon: <FileSignature className="w-5 h-5" />,
    accent: "text-emerald-600",
    accentBg: "bg-emerald-50 border-emerald-100",
    blocks: [
      {
        heading: "Business Function",
        items: [
          {
            label: "Digitizing Official Letters",
            desc: "Replaces manual correspondence and sending via email. The entire letter cycle — from drafting through signing and archiving — is managed on a single platform with a full audit trail.",
          },
          {
            label: "Standardization & Numbering",
            desc: "Every letter receives an automatic number based on its category code and yearly sequence, ensuring numbering consistency across the company and preventing duplicates.",
          },
        ],
      },
      {
        heading: "Status Flow",
        items: [
          { label: "DRAFT", desc: "Letter created by the requester. Editable, and the draft file can be replaced. Not yet in the approval flow." },
          { label: "SUBMITTED", desc: "The requester submits the letter. The approval flow begins according to the configured template." },
          { label: "APPROVED", desc: "All approval steps have been approved. The requester can upload the final document (signed letter)." },
          { label: "REJECTED", desc: "Rejected at one of the approval steps. The approver must provide a reason for rejection." },
        ],
      },
      {
        heading: "Features",
        items: [
          { label: "Letter Management", desc: "Create a letter with a subject, recipient, PIC, category, department, and issuing company. Each letter is tied to a single Euromedica Group company." },
          { label: "Automatic Letter Number", desc: "The number format is based on the category code and a yearly counter. Unique per category per year — cannot be duplicated even if created simultaneously." },
          { label: "Letter Category", desc: "Master category data with a unique code (e.g. SK, SP, SE). Admins can configure whether a category requires a draft file upload at creation." },
          { label: "Department", desc: "Master data for departments/work units with a code. Used for filtering and approval routing." },
          { label: "Document Upload", desc: "Two upload stages: (1) the draft file when creating the letter, (2) the final signed file after approval. Stored in internal Nextcloud." },
          { label: "Multi-Step Approval", desc: "The approval template is configured per department/category combination. Each step can be assigned to a specific user, position, or department. Step order is strict — no skipping." },
          { label: "Activity Log", desc: "Every status change is logged: who performed it, when, and any notes. The full history cannot be deleted." },
          { label: "Nextcloud Storage", desc: "Draft and final files are uploaded to Euromedica's internal Nextcloud storage. Server credentials are configured via NEXTCLOUD_URL, NEXTCLOUD_USER, NEXTCLOUD_PASS." },
          { label: "Statistics Dashboard", desc: "Total letters, pending approval, approved, rejected, and the logged-in user's own letters. Data is scoped per logged-in user." },
        ],
      },
      {
        heading: "Security",
        items: [
          { label: "Session Required", desc: "Every /api/ssd/* endpoint is protected by a NextAuth session. Returns 401 if unauthenticated." },
          { label: "Per-Step Approval Validation", desc: "Every approve/reject action is validated to confirm the user is the approver designated for the currently active step. No skipping steps or approving on someone else's behalf." },
          { label: "Internal Storage", desc: "Files are stored on the company's internal Nextcloud, not a public cloud. File URLs cannot be accessed without Nextcloud credentials." },
          { label: "Immutable Audit Trail", desc: "The activity log cannot be edited or deleted via the API. Every status change always appends a new record rather than overwriting an old one." },
        ],
      },
    ],
  },
  {
    id: "eu",
    title: "Euro Update",
    subtitle: "Internal information platform — news feed, birthdays, events, and announcements for Euromedica Group",
    icon: <Newspaper className="w-5 h-5" />,
    accent: "text-orange-600",
    accentBg: "bg-orange-50 border-orange-100",
    blocks: [
      {
        heading: "Business Function",
        items: [
          { label: "Internal Information Channel", desc: "Euro Update is the official channel for distributing internal information across Euromedica Group: company announcements, events, news, and other content relevant to all employees." },
          { label: "Employee Engagement", desc: "Employees can interact with content through reactions (ThumbsUp, Heart, etc.) and comments. The birthday feature encourages a culture of appreciation among coworkers." },
          { label: "Integrated with Portal", desc: "Birthday, event, and announcement widgets appear directly on the portal dashboard so important information is visible without entering the EU app. A feed preview is also available below the app grid." },
        ],
      },
      {
        heading: "Feed & Content",
        items: [
          { label: "Categorized Posts", desc: "Every post is tied to a single category (Event, Announcement, News, etc.). Categories are configured by admins: name, color, emoji icon, and whether they can be pinned." },
          { label: "Hero Slider (Pinned)", desc: "Pinned posts appear as a hero slider/carousel at the top of the feed. Admins can set the pin order. The slider only appears when there are pinned posts." },
          { label: "Filter & Search", desc: "Users can filter the feed by category or search by title/content. Category filters appear as a horizontally scrollable pill row. Search is debounced at 300ms to reduce requests." },
          { label: "Thumbnail & Rich Content", desc: "Posts can have an image thumbnail. On the portal dashboard, thumbnails are shown at a fixed size (172×129px). In the EU app, full HTML content is rendered in the post detail modal." },
          { label: "Pagination", desc: "The feed loads page by page (default 10 posts per page). Previous/Next navigation appears at the bottom of the feed." },
          { label: "Read Tracking", desc: "Every post click logs an EuRead entry per user — useful for content engagement analytics down the line." },
          { label: "Create & Edit Post", desc: "Users with canPost permission can create a new post (title, rich-text content, category, thumbnail, pin toggle). Admins can edit or delete (soft delete) any post." },
        ],
      },
      {
        heading: "Birthdays & Events",
        items: [
          { label: "Birthday Widget", desc: "Shows employees whose birthday is today. Data comes from the dateOfBirth field on the User table. Displayed in the EU app sidebar and the portal dashboard sidebar." },
          { label: "Birthday Modal", desc: "Clicking a birthday card opens a detail modal: profile photo, position, well-wishes, a comment form, and birthday-specific reactions (polymorphic: targetType='birthday', targetId='{userId}_{year}')." },
          { label: "Upcoming Events", desc: "Posts categorized as 'Event' with a future event date are shown in the Upcoming Events widget. Sorted by the nearest event date." },
          { label: "Announcement Widget", desc: "Posts categorized as 'Announcement' are shown in their own widget (Megaphone icon, orange theme). Displayed in both the EU app sidebar and the portal." },
        ],
      },
      {
        heading: "Comments & Reactions",
        items: [
          { label: "Emoji Reactions", desc: "Users can react to a post or a birthday with an emoji (ThumbsUp, Heart, etc.). One reaction per user per piece of content — clicking the same type again toggles it off, clicking a different type switches the reaction." },
          { label: "Comments", desc: "Users can comment on posts and on birthdays. Comments use a polymorphic model (EuComment) with targetType and targetId — not tied by FK to EuPost, so it can be used for both birthdays and posts." },
          { label: "Delete Own Comment", desc: "A comment's author can delete their own comment. The red trash icon is always visible (not hover-only). Deletion is a soft delete (deletedAt is set, data is not permanently removed)." },
          { label: "Comment Soft Delete", desc: "Deleted comments don't appear in the UI (filtered by deletedAt: null) but remain in the database for auditing. Only the comment's owner can delete it." },
        ],
      },
      {
        heading: "Admin & Configuration",
        items: [
          { label: "EU Settings", desc: "An admin-only configuration page for EU: category management (add/edit/delete), configuring who can post, and other settings." },
          { label: "Icon Registry", desc: "The Euro Update app card icon on the portal dashboard uses the 'Newspaper' icon (Lucide), registered in icon-registry.ts with the color text-orange-500." },
          { label: "Dynamic Categories", desc: "Categories are configured in the database (EuCategory), not hardcoded. Color, emoji icon, and the pinnable flag can be changed without a redeploy." },
        ],
      },
      {
        heading: "Security & Access",
        items: [
          { label: "Session Required", desc: "Every /api/eu/* endpoint is protected by a NextAuth session. Returns 401 if unauthenticated." },
          { label: "Module-Based Access", desc: "EU app pages are only accessible to users who have the Euro Update module in their role. Checked server-side in layout.tsx — cannot be bypassed via direct URL access." },
          { label: "Delete Own Content Only", desc: "The comment DELETE API (for both posts and birthdays) validates that comment.userId === session.user.id before deleting. Returns 403 if not the owner." },
          { label: "File Upload", desc: "Image files for EU content are stored in /uploads/ on the local server. File access is session-protected via /api/files/." },
        ],
      },
    ],
  },
];

function DocBlock({ block }: { block: Block }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-slate-700">{block.heading}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {block.items.map((item, i) => (
            <div key={i} className="px-5 py-3.5">
              <p className="text-sm font-medium text-slate-800 mb-1">{item.label}</p>
              {item.desc && <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AppSection({ doc }: { doc: AppDoc }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden ${doc.accentBg}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:opacity-90 transition-opacity"
      >
        <div className={`${doc.accent} flex-shrink-0`}>{doc.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-base ${doc.accent}`}>{doc.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{doc.subtitle}</p>
        </div>
        {open
          ? <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
          : <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="bg-white px-6 py-5 space-y-3 border-t border-slate-200">
          {doc.blocks.map((block) => (
            <DocBlock key={block.heading} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DevDocsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Developer Documentation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Internal documentation of Euro Portal's business functions, features, and security.
          </p>
          <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
            ⚠ Superadmin mode only
          </span>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {DOCS.map((doc) => (
          <AppSection key={doc.id} doc={doc} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center pb-4">
        Euro Portal · Euromedica Group · Internal Use Only
      </p>
    </div>
  );
}
