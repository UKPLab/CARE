# Study acknowledgement verification, 2026-11-06

Verdict: component fix verified; full participant flow NOT merge-certified.

Source checkout: 0eff222340937bc2819c54b4c15fd9b8a35904d9.
Current-dev comparison: b46d9a4b494b507dbe3703d8f34f0b1132a3bb1f.
Baseline swaps ONLY StudyModal from current dev into this checkout's fixed BasicModal harness. This deliberately isolates acknowledgement lifetime from the separate BasicModal work.

Results:
- Current-dev StudyModal: 3/6 pass in Node and actual T3 preview Chromium. Late success and late error throw TypeError: this.$t is not a function; repeated starts emit three requests instead of one.
- Initial checkout capture fix: 5/6 pass in Node; only duplicate requests fail (3 !== 1).
- Added pending-request guard: 6/6 focused tests pass; combined with existing lifecycle suite, 24/24 pass.
- Actual browser: fixed 6/6 pass. Browser result JSON preserves caught failures, success results and pageErrors. No uncaught page errors, no BasicModal errors in these cases. Baseline failures are intentionally caught by the test runner, so baseline pageErrors=[] does not mean no failure.
- Toast text survives parent removal for success and failure; mounted acknowledgement and failed-start retry work. Synthetic request IDs are study=3/session=5; there is no persisted state or real session-ID claim.

Production delta: startPending suppresses concurrent startStudy calls, disables the main start button while pending, and clears on acknowledgement so rejection can be retried. Existing translation capture is adequate for tested Vue/i18n lifetimes. No additional unmount flags. BasicModal untouched.

Isolation and limitations:
- Actual Chromium component rendering with real Vue, vue-i18n and Bootstrap; controlled socket, store and unrelated child components. Real full Study route, login, backend, DB, participant navigation, persisted session counts and actual server refresh-before-delayed-ack were NOT exercised. Parent removal simulates refresh/page departure; it is not proof of network ordering. No production hooks or AI calls.
- No full app dependencies installed/build attempted. Temp isolated dependencies: Vue 3.5.30, vue-i18n 11.4.2, Bootstrap 5.3.8, Happy DOM 20.8.9; Node 25.2.1. These do NOT verify the newer manifest minima (Vue ^3.5.44, vue-i18n ^11.4.17, Happy DOM ^20.14.6). Browser user agent retained in baseline JSON.
- resolveApiMessage is replaced by response.message as in existing lifecycle rig; production translated error-key resolution not separately verified.
- Dev drift: current dev adds infoOnly prop, conditional footer, modal name/keyboard/close behavior. Preserve all of those during integration. Apply only this commit's pending-request delta, plus the existing capture fix, rather than replacing current dev's entire StudyModal file.
- Parent checkout, shared DB and lockfiles untouched. Services on 45183/45184 stopped and preview tab closed. No push, PR or external writes.

Runnable PowerShell from this worktree root:

    $rig = Join-Path $env:TEMP 'care-510-ack-790876d1'
    npm.cmd install --prefix $rig --no-audit --no-fund vue@3.5.30 vue-i18n@11.4.2 bootstrap@5.3.8 happy-dom@20.8.9
    # If frontend/node_modules does not yet exist:
    New-Item -ItemType Junction -Path frontend/node_modules -Target "$rig/node_modules"
    node --test frontend/tests/study-start-ack.test.js frontend/tests/study-start-lifecycle.test.js
    git show b46d9a4b494b507dbe3703d8f34f0b1132a3bb1f:frontend/src/components/study/StudyModal.vue | Set-Content -Encoding utf8 "$rig/dev-StudyModal.vue"
    $env:STUDY_MODAL_SOURCE = "$rig/dev-StudyModal.vue"
    node --test frontend/tests/study-start-ack.test.js
    Remove-Item Env:STUDY_MODAL_SOURCE
    node frontend/tests/evidence-510-ack/browser-rig.mjs
    # Open http://127.0.0.1:45183 in T3 preview; read window.done/results/pageErrors.
    # For baseline, set STUDY_MODAL_SOURCE as above before starting the browser rig.
    # Ctrl+C stops the rig. PORT overrides its default unique port.
