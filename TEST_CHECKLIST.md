# Manual smoke test checklist

Run `npm run dev` for the frontend, then `npm run tauri dev` for Linux native behavior.

- [ ] Starter blocks appear on first launch only, editable/removable.
- [ ] New block creates a time entry on selected day.
- [ ] Editing a block changes its title and time.
- [ ] Overlapping time entries are rejected.
- [ ] End time earlier than or equal to start time is rejected.
- [ ] Completing a focus block updates Today and Insights counts.
- [ ] Focus starts a countdown; pause/resume and reset work.
- [ ] Timer remains accurate after minimizing the window and waking from sleep.
- [ ] Closing/reopening desktop restores local blocks and remaining timer state.
- [ ] Week view changes week and opens individual days.
- [ ] Notifications can be enabled, and one is sent on timer completion while app is running.
- [ ] Export JSON backup through a native save file dialog.
- [ ] Import previously exported JSON through native open file dialog.
- [ ] Reset all blocks with confirmation.
- [ ] `npm run build` compiles frontend.
- [ ] `npm run tauri build` generates a usable `.deb`.
