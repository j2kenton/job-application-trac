# Job Application Tracker

A streamlined application management system that processes forwarded emails and tracks job applications with smart deduplication and status filtering.

**Experience Qualities**:
1. **Efficient** - Minimal friction from email forwarding to organized tracking
2. **Clear** - Status and progress are immediately visible and actionable  
3. **Reliable** - No lost applications, smart duplicate detection, persistent data

**Complexity Level**: Light Application (multiple features with basic state)
- Handles email parsing, data persistence, filtering, and CRUD operations but maintains simplicity through focused feature set

## Essential Features

**Email Processing**
- Functionality: Parse forwarded emails to extract company, position, and application details
- Purpose: Eliminate manual data entry while capturing application context
- Trigger: User forwards application email to designated address or pastes email content
- Progression: Paste email → Parse automatically → Review extracted data → Confirm save → Application added
- Success criteria: Accurately extracts company name, job title, and date from common email formats

**Application Management**
- Functionality: Add, edit, and delete job applications with key tracking fields
- Purpose: Maintain comprehensive record of application pipeline
- Trigger: Manual entry or editing existing applications
- Progression: Click add → Fill form → Save → Application appears in list
- Success criteria: All applications persist between sessions, edits save correctly

**Duplicate Detection**
- Functionality: Prevent duplicate entries based on company + position combination
- Purpose: Keep data clean and avoid confusion from multiple entries
- Trigger: Adding application with existing company/position pair
- Progression: Attempt to add → System detects match → Show warning → User confirms or cancels
- Success criteria: No accidental duplicates, clear user choice when intentional duplicates needed

**Status Filtering & Display**
- Functionality: Filter applications by status (Applied, Interview, Offer, Rejected, etc.)
- Purpose: Focus on applications needing attention and track pipeline progress
- Trigger: Select filter option or view all applications
- Progression: Choose filter → List updates → Clear status indicators visible
- Success criteria: Instant filtering, accurate counts, easy status changes

## Edge Case Handling

- **Malformed emails**: Graceful parsing failure with manual entry fallback
- **Empty states**: Helpful guidance when no applications exist or filters return nothing
- **Invalid data**: Form validation prevents incomplete applications
- **Parsing errors**: Clear feedback when email content can't be processed

## Design Direction

The design should feel professional yet approachable - like a tool that respects the seriousness of job hunting while reducing stress through clarity and organization.

## Color Selection

Complementary (opposite colors) - Using a calming blue primary with warm orange accents to balance professionalism with optimism and energy.

- **Primary Color**: Deep Blue (oklch(0.45 0.15 240)) - Conveys trust, professionalism, and stability
- **Secondary Colors**: Light Blue (oklch(0.85 0.08 240)) for backgrounds and subtle elements
- **Accent Color**: Warm Orange (oklch(0.65 0.18 45)) - Energetic highlight for CTAs and success states
- **Foreground/Background Pairings**: 
  - Background (White oklch(1 0 0)): Dark Blue text (oklch(0.25 0.1 240)) - Ratio 8.2:1 ✓
  - Card (Light Gray oklch(0.98 0.01 240)): Dark Blue text (oklch(0.25 0.1 240)) - Ratio 7.8:1 ✓  
  - Primary (Deep Blue oklch(0.45 0.15 240)): White text (oklch(1 0 0)) - Ratio 6.1:1 ✓
  - Accent (Warm Orange oklch(0.65 0.18 45)): White text (oklch(1 0 0)) - Ratio 4.8:1 ✓

## Font Selection

Clean, readable sans-serif that projects competence and clarity - Inter for its excellent legibility and professional character.

- **Typographic Hierarchy**: 
  - H1 (App Title): Inter Bold/32px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/24px/normal spacing  
  - H3 (Company Names): Inter Semibold/18px/normal spacing
  - Body (Job Details): Inter Regular/16px/relaxed line height
  - Small (Metadata): Inter Medium/14px/tight line height

## Animations

Subtle functionality-focused animations that provide feedback without distraction - reinforcing the professional, efficient experience.

- **Purposeful Meaning**: Quick transitions communicate responsiveness and system feedback
- **Hierarchy of Movement**: Status changes and filtering get priority animation attention

## Component Selection

- **Components**: Card for application entries, Select for status filtering, Dialog for email parsing, Form for manual entry, Badge for status indicators, Button for actions
- **Customizations**: Custom email parsing interface, application status timeline component
- **States**: Hover states on cards, loading states during email processing, active states on filters
- **Icon Selection**: Briefcase for applications, Filter for sorting, Plus for adding, Edit for modifications
- **Spacing**: Consistent 4-unit (16px) padding, 6-unit (24px) gaps between sections
- **Mobile**: Single column layout, collapsible filters, swipe actions for status updates