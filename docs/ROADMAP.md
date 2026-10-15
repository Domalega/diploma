# Daymark roadmap

## Current foundation

The workspace has movable, resizable calendar, date, notes and medication tiles on a collision-aware grid. Tiles can move into open space, push neighbours aside and resize using an edge or corner. Positions, order and sizes are browser preferences, separate from the notes and medication data. Resizing does not remount tile content or change note dates. Small screens keep an adaptive arrangement and preserve desktop positions and widths.

## Planned direction: a Kanban view

Add a board alongside Month and List. Calendar and Kanban must show the same notes, with the same IDs, dates and reminder settings. Moving a card between columns changes its workflow status; changing a date remains a separate action. Medication schedules and intake marks stay a separate feature.

### 1. Shared card model and safe migration

- Extend notes into cards with a title, description, optional date/time, column ID and stable position. Keep existing note IDs and ownership.
- Introduce personal boards and editable columns. Start with Inbox, In progress and Done; allow renaming, reordering and additional columns.
- Migrate existing notes to Inbox without changing their text, dates, times or reminders. Undated cards appear on the board, dated cards also appear in the calendar.
- Version and migrate the data schema. Define completion/reminder behavior before adding status transitions; a column name alone must not silently suppress reminders.

### 2. Board interactions

- Add card creation, editing, search and movement within/between columns.
- Support pointer and touch dragging, keyboard movement and an explicit Move action as an alternative.
- Save a move atomically, verify ownership on the server, and handle concurrent edits without silently overwriting a newer order. Roll back failed optimistic moves.
- Share the editor and selection state across Month, List and Board. Keep tile arrangement separate from moving cards inside the board.

### 3. Persistence and rollout

- Store board/column/card order in the database; browser tile preferences remain independent. Consider account-synced workspace layouts separately.
- Release Board behind an experimental option first. Keep Month and List available throughout the transition.
- Verify migration of existing notes, API authorization, ordering conflicts, keyboard/touch operation, narrow layouts and reminder consistency across views.
- Enable by default only after existing accounts can switch views without losing or duplicating data.

This is a development plan, not an implemented feature or a scheduled release. Start with the shared card model and migration before replacing the workspace layout or introducing collaboration.
