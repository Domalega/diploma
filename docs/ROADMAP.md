# Daymark roadmap

## Current workspace

Calendar, current date, notes, medication tracker, optional Kanban board and to-do list are independent, movable and resizable tiles on a collision-aware grid. Workspace positions and sizes are browser preferences; notes, medication data, board data and to-do tasks belong to the signed-in account.

## Experimental to-do list

Enable the checklist in Settings → Experimental options. Enter creates a task; pasting multiple lines creates separate tasks. Checkboxes mark completion with strikethrough and can reopen tasks. Inline editing and deletion are available. Tasks persist in the account when the tile is disabled; stale updates are rejected and failed saves preserve drafts. The list is independent of calendar notes and Kanban stages.

## Experimental Kanban board

Enable the board in Settings → Experimental options. The first version includes:

- To do, In progress and Done stages, plus custom stages. Every column can be renamed, reordered or hidden without removing tasks.
- Configurable work-in-progress limits on active stages, enforced by the API. In progress starts with a limit of three.
- Task titles, descriptions and optional calendar dates. Dated tasks appear in the month grid; a card's date opens the corresponding calendar day.
- Pointer/touch dragging, a stage selector, and keyboard-accessible reorder buttons.
- Completion, reopening, a completed-task history and a per-task activity log. Completion never deletes a task.
- Account-scoped database persistence, atomic moves and revision checks that reject stale edits. Failed saves keep the editor draft.

The [Kanban Guide](https://kanbanguides.org/the-kanban-guide) calls for an explicit workflow and control of work in progress; it does not prescribe column names. The initial stages are convenient defaults. This experimental board does not yet implement the guide's full set of flow metrics or service-level expectations.

## Next steps

1. Evaluate the experimental board with real workflows, including narrow screens, hidden stages, concurrent sessions and long task histories.
2. Design a shared note/task model and a versioned migration. Preserve existing note IDs, text, dates, times, ownership and reminders. Current board tasks remain separate from calendar notes and have no reminders.
3. Share editing and selection across Month, List and Board. Keep workflow changes separate from date changes; define completion and reminder behavior before migrating existing notes.
4. Add pagination and history filters as account data grows. Consider cycle time, throughput, work-item age and service-level expectations.
5. Consider account-synced workspace layouts separately from task data. Medication schedules remain independent.

These are development directions, not scheduled release commitments. Keep the board opt-in until the shared model and migration can preserve existing accounts without losing or duplicating data.
