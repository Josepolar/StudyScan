# Student guided tours

Students get an optional Scout welcome prompt on their first visit in a browser. **Quick tour** in the header replays the workspace walkthrough; inside a lesson it becomes **Lesson tour**. Teachers and administrators do not get the student tour.

The workspace walkthrough highlights the welcome area, progress cards, class joining, navigation, lesson search/results, activities, and question history. The lesson walkthrough highlights approved material, resources, review progress, activity instructions when present, assistant context, question composition, and conversation history. Source passages, teacher flags, and teacher replies get additional steps when present.

Next/Back advance between highlighted controls. Skip, Close, Finish, and Escape dismiss the walkthrough. Workspace tours return to the page they were started from. Viewing a tour does not join a class, change review progress, send questions, or submit work. The initial prompt preference is stored locally under a versioned, account-specific key; no database migration or analytics collection is needed. Blocked browser storage does not prevent replay.

The modal traps keyboard focus, makes the underlying workspace inert, restores focus when closed, announces step content, and respects reduced motion. It recalculates spotlight/card bounds on scrolling, resizing, and menu transitions. Missing targets fall back to a centered explanation. Tooltips are scrollable on short screens.

Verification: TypeScript check and production build; browser walkthrough of all nine workspace steps and all seven base lesson steps; optional source/flag steps on a conversation; activity step on an assigned activity; spotlight/card bounds; Back, Escape, completion, reload persistence, replay, page/focus restoration, and no tour on teacher screens. Production checks also cover an account with no assigned materials. No AI requests or activity submissions are made during these checks.
