# State machine first: a pilot on CARE #220

**What:** keyboard shortcuts for assessment justification fields
**Method:** write the state machine before the implementation, derive the code from it
**Status:** pilot on a throwaway branch, not for `dev`

---

## 1. What we built

Issue #220 asks for three keys in the assessment sidebar: Enter saves, Shift+Enter
inserts a newline, and something moves you to the next criterion. It reads like a
one-hour ticket.

It isn't, because the sidebar has **two Save buttons** that look identical — both
floppy icons, never on screen at the same time. One commits your typed text
(`saveEdit`). The other marks the criterion done and advances (`saveAssessment`).
Committing your text actually sets the criterion back to *not saved*.

The textarea only exists while editing, so a key pressed inside it can only ever
reach the first Save. The Save the issue author meant is unreachable from the
field. So the feature is not "bind a key" — it is "decide what the keyboard-save
*is*".

**The loop we shipped**, six presses per criterion:

Enter on header → Tab to pen → Enter → type → **Ctrl/Cmd+Enter** commits →
Enter marks done and advances → focus lands on the next criterion's header.

Plain Enter and Shift+Enter keep their native newline behaviour, so half the
issue was satisfied by writing no code at all.

---

## 2. How to read the diagrams

| What you see | What it means |
|---|---|
| a box | a situation the thing can be in |
| an arrow between boxes | the user did something, and where it lands them |
| an arrow looping back | the event happened and **nothing changed** |
| `ignored` on a loop | nobody designed a behaviour for this — a **sneak path** |
| ⚠ | an existing CARE bug, not introduced by this feature |

The loops matter as much as the arrows. Every key a user can press in a given
situation has to land somewhere, and "nowhere" is still an answer that has to be
checked.

*(diagrams: `assessment-keyboard-state-machine.md`)*

---

## 3. The workflow

1. **Read** — grep and read the actual components; never guess at file contents
2. **Plan** — decisions agreed before any modelling
3. **Model** — states, events, guards, every cell filled or marked impossible
4. **Implement** — nothing gets coded that isn't a cell
5. **Test** — walk routes and sneak cells in the browser
6. **Record** — written last, from what actually happened

Three orthogonal regions, because three things happen at once and all receive the
same keypress:

| Region | Scope | Tracks |
|---|---|---|
| field | one criterion | what the editor is doing |
| position | the whole step | which rubric/criterion is open |
| save | the whole assessment | the `documentDataSave` round trip |

---

## 4. What the modelling forced

**The issue's three open questions, answered as cells before any code existed:**

| Open question | Answer |
|---|---|
| Enter on the last criterion | already handled in code — advances to the next rubric; past the last, focus the forward control |
| Enter = save, or save-and-next | the mouse path is already save-and-next, so the keyboard matches it |
| "clear feedback" when saving is blocked | nothing blocks saving; failures were silent — so we added a toast instead |

**A fourth question the issue never asked:** given two Saves, what does one
keypress mean? Answer: it mirrors the mouse exactly — one press commits text, a
second marks done.

**The backwards arrow.** `done → EDIT → editing → CTRL_ENTER → read`. Fixing a
typo in a finished justification *un-finishes* it. Under `forcedAssessment` that
un-completes the whole step and disables Finish Study until you press Enter once
more. Three legal transitions that undo work the user thought was done.

**The grid:** 96 cells — 60 designed, 22 sneak, 14 impossible.

**Two modelling mistakes the grid caught on itself:**
- "sneak path" was being used for two different things. A sneak path means
  *nothing changes*; if state or data changes it is a transition, even a harmful
  unintended one. Drawing the self-loops reclassified 5 cells.
- Event names had absorbed focus state (`ENTER on pen` as its own event), which
  broke the region separation the model was built on.

*7 pre-existing CARE bugs were also found, but by reading files, not by the
method. Sent to Dennis separately; not this pilot's credit.*

---

## 5. The bug it caught

After implementation, walking the sneak cells in the browser:

**Cmd+Enter and Shift+Enter on a criterion header toggled the panel.**

Vue's `.enter` modifier fires on Enter regardless of what else is held. The table
said those cells were ignores. They weren't. A missing `.exact` — used correctly
on the textarea handler an hour earlier, forgotten on the headers.

Nobody clicks that. You only try Cmd+Enter on a header because a table has a row
for it.

---

## 6. What it cost

- Modelling: most of the evening
- Implementation: about an hour, mechanical — every edit followed from a cell
- Testing: ten minutes for 27 checks

**It did not save time.** One bug from n=1 is not a bug-finding claim.

The honest line: **it moved the hard part earlier, and surfaced situations nobody
would try.** By the end of the evening every situation the feature can be in had
a decided behaviour — including the ones we chose not to implement.

---

## 7. Coverage

- **27 checks walked**, all passing after the fix
- Not walked: most RELOAD and save-region cells — triggering them needs a second
  client or a deliberately failing server
- The save-failure toast is **implemented but unverified**: killing the backend
  triggers CARE's disconnect handling before a rejected save can happen, and a
  dead server never answers at all

That last failure produced a finding: an *unanswered* save is not a *rejected*
save. The model has `ACK_FAIL` but no event for "no answer ever arrives" — a
missing event, found by trying to run a test.

---

## 8. What XState bought

The machine is a real file (`assessment-keyboard.machine.js`), not a picture, so
it can be executed:

```
node src/components/study/assessment/generate-paths.js
→ 48 generated routes + 23 sneak checks
```

- **48 reachable cross-region combinations** the hand-drawn tables never
  enumerated — the tables are one per region, and a human stops there.
- One modelled state (`criterionLastInRubric`) turned out **unreachable** with
  the default context. The generator is a tool, not an oracle — the output has to
  be read, not trusted.
- `getSimplePaths` does not terminate on a three-region parallel machine.

**Level A (what we did):** the machine specifies; handlers written by hand to
match. **Level B (next):** the machine holds the state and the component asks it,
so the spec and the behaviour cannot drift.

---

## 9. Where this would pay off

The bug type it catches is specific: **transitions between situations**, and
**which controls exist in which situation**.

A rough pass over our own bug spreadsheet (my triage, unvalidated):

| Would a transition table have asked this? | Count |
|---|---|
| Yes | ~3 — AI request missing on step 1→2 but present after reload; assignment created directly into `closed`; "not allowed to see this study" after navigation |
| Maybe | ~5 — role-dependent controls, missing validation, modal remembering a stale anchor |
| No | ~15 — import data loss, TypeErrors, dark-mode CSS, leftover columns, icons rendering as text |

**Proposal:** tag the spreadsheet properly, and have someone else tag ten rows
blind as a check. That produces a number from our own data instead of a story
from one evening.

---

## 10. Limitations

- **n = 1**, no control condition — we cannot say what would have happened
  without the table, and the developer was also the advocate.
- **Selection bias**: this issue was chosen *because* one key means five things.
  Best possible case for state modelling.
- **The bug found was our own**, written the same evening by the same process.
  Catching your own mistake is less impressive than catching someone else's.
- **Coverage was 27 of 96 cells**, and the unwalked ones are the hard-to-trigger
  reload and save cells — exactly where bugs hide.
- **Cost is front-loaded**: hours of modelling for a one-hour implementation.
- **Level A permits drift.** The spec is not connected to the code, and we
  drifted once within a single turn.
- **Scale is unproven**: three regions already produced a combined grid too dense
  to project. A larger feature may not be modellable in one sitting.
- **Whole bug classes are untouched** — data mapping, bundling, CSS, i18n — which
  is most of the spreadsheet.

---

## 11. Follow-ups

- **Level B** — the machine runs the component; context updates, path generation
  becomes complete
- **Playwright** — turn generated routes into automated runs, so all 96 cells
  cost nothing to re-check
- **Full APG arrow navigation** between headers, crossing rubric boundaries
  (deliberately skipped: a shortcut that stops working at boundaries teaches
  users not to trust it)
- **Two deviations** needing agreement if this ever goes to `dev`:
  Ctrl+Enter instead of plain Enter (matches `Comment.vue`), and no dedicated
  next-criterion key (advancing falls out of saving)

---

## 12. Aside: accessibility

Tonight the assessment sidebar could not be used without a mouse. Four attributes
and two key handlers made it fully keyboard-operable.

A quick grep across `frontend/src` (**not** an audit):

- 34 of 234 `.vue` files carry any ARIA
- 19 clickable `<div>`s — controls a keyboard cannot reach
- 0 `aria-live` regions, in a real-time app
- no accessibility linting or testing in the toolchain

**Why it matters for us specifically:** participants who cannot use a mouse
cannot take part in studies run on CARE. That is a sampling and ethics problem
before it is a legal one. (Legal backdrop: German public bodies must meet
WCAG 2.1 AA via EN 301 549 and publish an accessibility statement; TU Darmstadt
falls under the Hessen state equivalent — to be confirmed.)

**Ask:**
1. Permission to audit the participant-facing views properly
2. Three cheap fixes now:
   - add `eslint-plugin-vuejs-accessibility`
   - give `BasicButton` a real accessible name — one component, every icon
     button on the platform
   - convert the 19 clickable divs (good first issue)
