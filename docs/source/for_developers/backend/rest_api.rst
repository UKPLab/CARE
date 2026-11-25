REST API (API tokens)
=====================

Scripts talk to CARE over HTTP with a personal API token. The Vue app still uses
Socket.IO and the session cookie. This page describes the slice that exists
today. Update it when a route is added or changed.

Enable the feature
------------------

Set **Enable API tokens** in System Settings (key ``system.auth.apiTokens.enabled``).
Default is off. When off, the API Tokens page is hidden and both cookie minting
and Bearer ``/rest/v1`` return ``errors.rest.apiTokensDisabled``.

Two doors
---------

* **Cookie** ``/auth/api-tokens`` — logged-in users create, list, and revoke keys
  (the dashboard). Scripts never call these paths.
* **Bearer** ``/rest/v1/...`` — every request sends
  ``Authorization: Bearer <secret>``. Identity is always the key owner. A
  ``userId`` in the JSON body is ignored.

Secrets start with ``care_``. CARE stores only a SHA-256 hash. The full secret
is returned once on create.

Where the code is
-----------------

* ``routes/rest/`` — the HTTP routes: they read and check the request, then call
  a REST function. ``routeHelpers.js`` holds the shared transaction, error, and
  upload handling.
* ``backend/webserver/rest/`` — the REST functions, one file per resource. They
  mirror the dashboard's socket methods where noted ("Mirrors …") and never call
  them. Files are named in the plural, like the route file that calls them and
  its URL (``rest/documents.js`` for ``/rest/v1/documents``); a resource split
  into parts adds the part (``documentUpload.js``, ``studyActions.js``).
  They read through the model's own helpers (``getById``, ``getByKey``,
  ``getAll``, ``getAllByKey``, ``getAllByKeyValues``) where a query is on one
  column, and otherwise (several conditions, OR, counts) through ``findActive``,
  ``findOneActive``, or ``countActive`` from ``utils/restHelpers.js``. Both leave
  out deleted rows and pass the write's transaction on.
* ``sockets/`` — the dashboard's socket methods, unchanged by the REST API.
* ``rest/socketEvents.js`` — every socket event, listed as covered by REST (with
  its route) or socket-only (with the reason). ``tests/rest.socketEvents.test.js``
  fails when a socket event is missing from it, so a new socket feature cannot
  skip the REST decision: add the event to one of the two lists.

Rate limits
-----------

Each user has two per-minute budgets, shared by all of that user's tokens, so
creating more tokens does not give more budget:

* every REST request: ``system.auth.apiTokens.rateLimitPerMinute`` (default 120);
* expensive writes, which also count against the first budget:
  ``system.auth.apiTokens.heavyRateLimitPerMinute`` (default 20). These are
  ``POST /documents/upload``, ``PUT /documents/:idOrHash/file``,
  ``POST /review-assignments``, ``POST /studies/import``,
  ``POST /templates/import``, ``POST /workflows/import``, ``POST /submissions``,
  ``POST /sessions/:idOrHash/copy``, and the bulk ``POST /studies/close``,
  ``/studies/open``, and ``/studies/delete``.

Before token auth, each IP address also has a budget for requests whose token is
missing, wrong, expired, or revoked: ``system.auth.apiTokens.failedAuthPerMinute``
(default 60). Only those ``401`` answers count, so working scripts never use it up;
once it is used up, every request from that address is ``429`` for the rest of
the minute. Behind a reverse proxy such as nginx, set ``TRUST_PROXY=1`` in
``.env`` so CARE sees the client's address and not the proxy's; otherwise all
clients share this budget.

Admins change these under Settings, General, API tokens. Over budget is ``429``
``errors.rest.rateLimitExceeded`` until the minute is over. Every response
carries ``RateLimit`` and ``RateLimit-Policy`` headers with the remaining count.
Each expensive route adds ``heavyRateLimit(server)`` from
``middleware/restRateLimit.js`` in its own definition, so the marking sits on the
route.

The budgets and the ``system.auth.apiTokens.enabled`` switch are read on every
request, so the backend keeps a copy for up to 30 seconds. Saving a setting in
CARE clears the copy, so a change applies at once; only a change made directly in
the database waits up to 30 seconds.

Errors
------

Every REST error is JSON with the i18n key in ``message``, the English sentence
in ``error``, and ``params`` when the sentence has placeholders::

    { "message": "errors.rest.studyNoAccess", "error": "You do not have access to this study." }

Scripts should compare ``message``, which stays stable; ``error`` is for people.
Broken JSON in a body is ``400`` ``errors.rest.invalidJson``. A body over the
JSON size limit is ``413`` ``errors.rest.bodyTooLarge``. A path or method that
matches no REST route is ``404`` ``errors.rest.routeNotFound``, so a script can
tell a wrong URL from a missing item (which has its own ``…NotFound`` key).

Transactions and retries
------------------------

Every REST write runs in one database transaction: all of it is saved, or
nothing is. A request that creates several things (review assignments for many
items, an import of several studies or templates) is all or nothing.
Exception: bulk ``POST /studies/close``, ``/open``, and ``/delete`` commit one
study at a time and skip ids they cannot act on, as the dashboard does; the
answer reports how many were done. Emails and dashboard refresh happen only
after commit. Files an upload wrote before a failure are deleted again.

Retrying a read, a ``PATCH``, or a ``DELETE`` is safe (a second delete is
``404``). A retried create would create twice, so ``POST`` requests accept an
optional ``Idempotency-Key`` header (1 to 255 visible ASCII characters, for
example a random UUID):

* the first request runs normally, and a successful answer is kept for 24 hours;
* a repeat from the same token with the same key, route, and body returns that
  answer with the header ``Idempotent-Replayed: true`` and does nothing again;
* the same key for another route or body, or from another token of the same
  user, is ``422`` ``errors.rest.idempotencyKeyReused``;
* a repeat while the first is still running waits for it and then gets its
  answer;
* a failed request keeps nothing, so it can be retried with the same key.

The key is checked after the route's right checks, so a token that has lost the
route's right gets ``403``, not a stored answer. For uploads the body means the
form fields plus each file's field, name, and content (its md5): the same key
with another file is ``422``, so a corrected file needs a new key.

A write reserves its key inside its own transaction and stores the answer there
too. If the server stops mid-request, the database drops the reservation with
the unfinished write, so a retry simply runs. The bulk study routes commit study
by study and cannot do that: their key is saved before they start, a repeat
while it runs is ``409`` ``errors.rest.idempotencyKeyInProgress``, and a key
still running after 10 minutes is treated as left behind by a stopped request
and taken over by the next retry. Repeating a bulk open, close, or delete is
safe, because studies already done are skipped. Keys are per user and live in
the ``api_idempotency_key`` table (``middleware/restIdempotency.js``).

Open dashboards
---------------

A REST write reaches open dashboards the same way a socket write does. After the
transaction commits, ``utils/restBroadcast.js`` hands the changed rows to the
existing table broadcast through ``Socket.broadcastChangesWithoutSocket`` in
``Socket.js``, so
each browser gets only the rows its user may see. A dry run or a failed request
broadcasts nothing. Every REST write opens its transaction with
``startRestTransaction`` for this. The answer is sent after the broadcast, so when
a script gets it, open dashboards already have the change. Notification emails
are sent after the answer and do not delay it.

Rights are checked on the token
-------------------------------

Every right check under ``/rest/v1`` asks one question: is the right on the
token, and does the owner still have it. The routes pass that check to the
REST functions as ``options.can`` (``tokenCan`` in
``middleware/bearerAuth.js``). The functions never look at the owner's roles
directly.

Being an admin gives a token nothing by itself. A token owned by an admin that
carries only ``frontend.dashboard.documents.view`` sees the admin's own
documents and nothing else. Reach beyond the owner's own objects always comes
from a named right on the token:

* all documents (list, get, link into a study or assignment) —
  ``frontend.dashboard.assignments.viewAll``
* replace the file of an own document —
  ``frontend.dashboard.assignments.replaceDeleteSubmissions``
* see and manage other users' studies — ``frontend.dashboard.studies.fullAccess``
* list the users of a role — ``backend.socket.user.getUsers.<role>`` or ``.all``

Writing to another user's document is not possible over REST at all. Rename,
publish, delete, and file replace work on the caller's own documents only, with
any token. Those actions on someone else's document stay in the dashboard.

A token only has the rights listed when it was created. There is no implicit
"every right", for the dashboard form and the cookie API alike.

Cookie paths
------------

All four need the API tokens page right ``frontend.dashboard.api_tokens.view``
(admins hold every right); without it they are ``403``
``errors.rest.apiTokensNoAccess``.

* ``GET /auth/api-tokens`` — own tokens. Admins see all (including ``userId``).
* ``POST /auth/api-tokens`` — body ``{ "name": "...", "rights": ["..."] }``.
  ``rights`` is required and not empty (``400`` ``errors.rest.tokenRightsRequired``),
  and may only hold rights the owner can attach (``403``). Optional
  ``expiresAt``, an ISO date in the future; without it the token does not expire.
  An expired token is ``401`` ``errors.rest.expiredBearer`` on ``/rest/v1``. The
  dashboard form offers 30, 90 (default), or 365 days, or never. Guest-only
  accounts cannot create keys. A user may hold at most 25 unexpired tokens
  (``400`` ``errors.rest.tooManyTokens``). The body must be JSON (``415``
  ``errors.rest.jsonRequired`` otherwise), so another site cannot create tokens
  through a hidden form. When a user is deleted, their tokens are revoked; a
  token whose owner is deleted is ``401`` ``errors.rest.tokenOwnerDeleted``.
* ``GET /auth/api-tokens/rights`` — what the create form offers: the rights the
  user can attach, with descriptions, and one preset per role (the role's rights
  cut down to what the user can attach). Token rows in the list and create
  responses include their ``rights``. The dashboard form starts with nothing
  ticked and needs at least one right.
* ``DELETE /auth/api-tokens/:id`` — owner or admin. Non-admins cannot revoke
  another user's key.

REST documents
--------------

Needs token right ``frontend.dashboard.documents.view``. The ``:idOrHash``
parameter accepts the numeric id or the document hash.

A document is returned with these fields only: ``id``, ``hash``, ``name``,
``type``, ``userId``, ``projectId``, ``public``, ``submissionId``,
``originalFilename``, ``createdAt``, ``updatedAt`` (``DOCUMENT_PUBLIC_FIELDS`` in
``rest/documents.js``). A new column stays out of REST until it is added
there. The routes call REST-only functions in ``backend/webserver/rest/``
(``documents.js``, ``documentUpload.js``, ``documentReplace.js``). The socket
methods in ``sockets/document.js`` are separate and unchanged.

* ``GET /rest/v1/documents`` — list. The owner's documents, or all documents
  with ``frontend.dashboard.assignments.viewAll`` on the token.
* ``POST /rest/v1/documents`` — JSON. Blank HTML (``type`` 1, default) or modal
  (``type`` 2). Body ``{ "name": "..." }``. Optional ``projectId``,
  ``templateId``. ``uploadedByUserId`` stays null (same as UI Create). PDF/ZIP
  types are rejected here. The project and the template must be the caller's
  own or public; otherwise the request is ``400``.
* ``POST /rest/v1/documents/upload`` — multipart field ``file`` (``.pdf``,
  ``.zip``, ``.delta``). Same as UI Upload (``addDocument``). Also needs token
  right ``frontend.dashboard.documents.upload``, like the dashboard. Optional
  ``projectId`` follows the same rule. Optional ``type`` may only be 1 or 2 and
  only matters for a ``.delta`` file. One file per request. A request over
  100 MB in total, the same cap as socket uploads, is ``413``
  ``errors.rest.fileTooLarge``. The size is checked from ``Content-Length`` before any
  file is read, so a client that is still sending may see the connection close
  instead of reading the ``413``; nothing is saved either way. A multipart request without ``Content-Length``
  (chunked) is ``411`` ``errors.rest.contentLengthRequired``, because its size
  cannot be checked first; this applies to every upload route. Other file types are ``400``
  ``errors.file.invalidFileType``. File names keep non-ASCII characters.
  ``importAnnotations`` is ``400`` ``errors.rest.importAnnotationsNotSupported``:
  importing a PDF's annotations needs the PDF text that the dashboard upload reads
  in the browser, so it stays a dashboard action.
* ``GET /rest/v1/documents/:idOrHash`` — one document as JSON.
* ``PATCH /rest/v1/documents/:idOrHash`` — ``name`` and/or ``public`` (publish is
  ``{ "public": true }``).
* ``DELETE /rest/v1/documents/:idOrHash`` — dashboard soft-delete.
* ``GET /rest/v1/documents/:idOrHash/content`` — text of an HTML or modal
  document: ``{ "document", "delta": { "ops": [...] }, "text": "..." }``. The
  delta is the editor's own format; ``text`` is its plain text. PDF and ZIP
  documents are ``400`` ``errors.rest.documentHasNoText``.
* ``GET /rest/v1/documents/:idOrHash/file`` — PDF or ZIP bytes. HTML/modal
  return ``errors.rest.documentHasNoBinaryFile``.
* ``PUT /rest/v1/documents/:idOrHash/file`` — replace PDF/ZIP bytes of an own
  document. Needs ``frontend.dashboard.assignments.replaceDeleteSubmissions``
  on the token. Id and hash stay the same. If the new file cannot be moved into
  place after the cleared annotations were saved, the answer is ``500``
  ``errors.rest.replacePromoteFailed``; the new file stays on the server and the
  log says where.

Missing document: ``404`` ``errors.rest.documentNotFound``. Document exists but
the token must not see or change it: ``403`` ``errors.rest.documentNoAccess``.

REST studies
------------

List and get need token right ``frontend.dashboard.studies.view``. Create,
patch, open, close, delete, template, import, and export need
``frontend.dashboard.studies.canManageStudies``. The ``:idOrHash`` parameter
accepts the numeric id or the study hash. A study is returned with the fields in
``STUDY_PUBLIC_FIELDS`` in ``rest/studies.js`` (no ``deleted``, ``deletedAt``,
or ``userIdClosed``), plus the study's AI cost limits ``aiCostLimitTotal``,
``aiCostLimitPerSession``, and ``aiCostLimitPerUser`` (a number, or ``null`` for
no limit).
The routes call REST-only functions in ``rest/studies.js``,
``rest/studyActions.js``, and ``rest/studyTransfer.js``. The socket methods are
separate and unchanged. Live bulk progress stays on the
socket; bulk open, close, and delete commit study by study and refresh
dashboards once at the end.

* ``GET /rest/v1/studies`` — list. Same visibility as the studies table: not
  templates, limited to the caller's default project (their own
  ``projects.default``, else the system one), filtered by the same rule as the
  Studies dashboard (``Study.getQueryTableScopeFilter``).
  A token with ``frontend.dashboard.studies.fullAccess`` sees those studies.
  Other tokens see studies their owner created.
* ``GET /rest/v1/studies/:idOrHash`` — one study as JSON. A template is not
  part of this list, so it is ``403``.
* ``POST /rest/v1/studies`` — create from a study template via ``study.add``.
  Body ``{ "templateId": 1 }`` plus any fields the create form sends (``name``,
  ``description``, ``workflowId``, ``tagSetId``, limits, dates, switches,
  ``stepDocuments``, and the three AI cost limits). ``userId`` in the body is
  ignored. Without AI cost limits the study keeps the template's, as in the
  dashboard form.
* ``PATCH /rest/v1/studies/:idOrHash`` — those same fields. A closed study or a
  template is rejected. AI cost limits are changed in place, so money already
  spent still counts; ``0`` or ``null`` removes a limit. An AI cost limit must be
  a number of at least ``0`` or ``null`` (``400`` ``errors.rest.invalidStudyField``).
  In both routes each ``stepDocuments`` entry is
  ``{ "id": <workflowStepId>, "documentId": <id or null>, "configuration": {} }``.
  Other keys are dropped. The caller must have access to every linked document,
  because a study's owner can read the documents in its steps.
* ``POST /rest/v1/studies/:idOrHash/close`` — close one study. Optional
  ``{ "notifySessions": true }`` sends the existing close emails.
* ``POST /rest/v1/studies/:idOrHash/open`` — reopen one study (``closed``
  cleared, same as Restart).
* ``DELETE /rest/v1/studies/:idOrHash`` — soft-delete via ``deleteById``.
* ``POST /rest/v1/studies/close`` — body ``{ "ids": [1, 2], "notifySessions": false }``.
* ``POST /rest/v1/studies/open`` — body ``{ "ids": [1, 2] }``.
* ``POST /rest/v1/studies/delete`` — body ``{ "ids": [1, 2] }``.
  Open, close, and delete each call one function. The item route passes a
  single id. The bulk route passes the array, at most 100 ids (``400``
  ``errors.rest.tooManyStudyIds``).
* ``POST /rest/v1/studies/:idOrHash/template`` — save that study as a template
  (``studySaveAsTemplate``).
* ``GET /rest/v1/studies/:idOrHash/export?format=json`` — the study plus
  ``study_step`` rows, JSON or ``format=yaml``. Same shape as the dashboard
  export modal.
* ``POST /rest/v1/studies/import`` — that same JSON array, or
  ``{ "format": "yaml", "content": "..." }``. Creates templates the way the
  dashboard import does (``studySaveAsTemplate`` with ``onlyTemplate``).
  Only the study fields accepted by ``POST /rest/v1/studies`` are read from each
  item, with the same type checks. Owner, closed state, and any other column in
  the file are ignored. An item without ``stepDocuments`` uses its ``study_step``
  rows, as the dashboard import does, so an export imports with its steps; every
  linked document must exist here and be accessible, else ``400``
  ``errors.rest.stepDocumentNotFound`` or ``403`` ``errors.rest.documentNoAccess``.

Missing study: ``404`` ``errors.rest.studyNotFound``. Study exists but the
token must not see or change it: ``403`` ``errors.rest.studyNoAccess``.

Subscribe and the live bulk progress channel are not in REST.

REST review assignments
-----------------------

The path is ``review-assignments`` because the ``assignment`` table (assignments
that collect submissions, the dashboard's Assignments page) is a different thing,
with its own routes under ``/rest/v1/assignments``.

One route covers what the dashboard does with ``assignmentCreateSingle``,
``assignmentCreateBulk``, and ``assignmentAdd``. It calls the REST-only function
``createReviewAssignments`` in ``rest/reviewAssignments.js`` (planning and
review studies are in ``rest/reviewAssignmentPlans.js`` and
``rest/reviewAssignmentStudies.js``). The socket methods are separate and
unchanged.

The body carries ids only. The study template, the items, the reviewers, and
the target study are loaded and access-checked on the server. Study fields in
the body are ignored.

* ``POST /rest/v1/review-assignments``

Create assignments from a study template::

    {
      "templateId": 5,
      "type": "document",
      "items": [11, 12, 13],
      "mode": "everyReviewer",
      "reviewers": [7, 8],
      "notify": false,
      "dryRun": false
    }

* ``type`` — what ``items`` are: ``document`` (default), ``submission``, or
  ``study_session``. One review study is created per item, owned by the item's
  owner. ``study_session`` also needs ``workflowMapping``
  (``{ "<workflowStepId>": <workflowStepId of the source study> | "previousSubmission" }``),
  the same mapping the dashboard sends.
* ``mode`` — who reviews what:

  * ``everyReviewer`` (default) — every item is reviewed by every user in
    ``reviewers``. With one item this is the single assignment.
  * ``byRole`` — ``"roles": [ { "role": "student", "items": 2 } ]`` (role name or
    id). Every user of that role reviews that many items. The users are resolved
    on the server, so the caller never needs the user list. Optional
    ``reviewers`` limits the pool. The caller needs
    ``backend.socket.user.getUsers.<role>`` or ``backend.socket.user.getUsers.all``.
  * ``byCount`` — ``"counts": [ { "userId": 7, "items": 2 }, { "userId": 8, "items": 1 } ]``.
    Each item goes to one reviewer.
  * ``sessionOwner`` — ``type`` ``study_session`` only. Each session goes back to
    its own user.

  In ``byRole`` and ``byCount`` mode nobody reviews their own item, and the
  distribution is random. A role or user may appear only once in its list.
* ``notify`` — send the assignment email to each reviewer after commit. Default
  off.
* ``dryRun`` — write nothing and return ``{ "dryRun": true, "plan": [ { "itemId": 11, "reviewerIds": [7] } ] }``.
  Because the distribution is random, a later real call can differ from the plan.

Add reviewers to an existing study::

    { "studyId": 40, "reviewers": [9] }

Send either ``templateId`` or ``studyId``, not both. Adding reviewers raises the
study's session limit when needed; a study without a limit (0 or empty) keeps none.

A successful write is ``201`` with
``{ "dryRun": false, "studies": [ { "id", "hash", "name", "itemId", "sessions": [ { "id", "hash", "userId" } ] } ] }``.
Everything in one request is one transaction: if one item fails, nothing is
created.

Token rights follow the dashboard: one item in mode ``everyReviewer``, or adding
reviewers, needs ``frontend.dashboard.studies.addSingleAssignments``. Anything
else needs ``frontend.dashboard.studies.addBulkAssignments``.

Items the caller may assign: any with ``frontend.dashboard.assignments.viewAll``;
otherwise documents the caller can open, their own submissions, and sessions of
studies they can see. Unknown template, item, reviewer, role, or study is
``404``. No access is ``403``. Distribution failures (for example not enough
documents for a role) are ``400`` with the ``errors.assignment.*`` key and its
``params``.

REST study sessions
-------------------

The functions are in ``rest/sessions.js``. The socket methods are
separate and unchanged. A caller starts and finishes only their own sessions.

Reading needs ``frontend.dashboard.my_sessions.view`` or
``frontend.dashboard.session_overview.view``; what a caller sees still depends
on ownership. Starting and finishing need ``frontend.dashboard.my_sessions.view``.

* ``GET /rest/v1/sessions`` — the caller's own sessions.
* ``GET /rest/v1/sessions/:idOrHash`` — one session: the caller's own, or one of
  a study the caller may see.
* ``GET /rest/v1/studies/:idOrHash/sessions`` — sessions of one study. Someone
  who may see the study (owner, or ``frontend.dashboard.studies.fullAccess`` on
  the token) gets all of them; anyone else gets only their own.
* ``POST /rest/v1/studies/:idOrHash/sessions`` — start a new session in that
  study for the caller (``studySessionStart``). ``201``. A closed study is
  ``400`` ``errors.studies.studyClosed``; the study's session limits and start
  date apply too (``400``). REST checks these itself, because the dashboard only
  hides its Start button.
* ``POST /rest/v1/sessions/:idOrHash/start`` — set the start time of an own
  session that was assigned but not started.
* ``POST /rest/v1/sessions/:idOrHash/finish`` — finish an own session. A
  finished session, or a closed study, is ``400``.
* ``POST /rest/v1/sessions/:idOrHash/copy`` — body ``{ "userIds": [7, 8] }``.
  Gives each user a copy of the session (``studySessionCopy``) and raises the
  study's session limits. Needs
  ``frontend.dashboard.studies.canManageStudies`` and the right to manage that
  study. ``201``.

* ``DELETE /rest/v1/sessions/:idOrHash`` — soft-delete a session of a study the
  caller created, or any with ``frontend.dashboard.studies.fullAccess``. Needs
  ``frontend.dashboard.studies.canManageStudies``. Same as the Delete action in
  the dashboard's session table.

Reopening a finished session is not in REST. The user story "Reopen a
Participant's Finished Session" describes it, but no dashboard or socket code
reopens a session; copying a session (above) is the closest action.

Start and finish send the study's notification emails after commit when the
study has email notifications on, as the sockets do. Missing session or study
is ``404``. Someone else's session is ``403`` ``errors.rest.sessionNoAccess``.

* ``GET /rest/v1/studies/:idOrHash/assessment?configurationId=N`` — the
  assessment scores of that study for one assessment configuration:
  ``{ "studyStepId", "documentId", "sessions": [ { ...session, "scores": { "<criterion>": <points> } } ] }``.
  The sessions are the ones the caller may see, by the same rule as the session
  list. Scores saved for a session win; otherwise scores saved on the step's
  document are used. Same token rights as the session list. The function is
  ``studyAssessmentScores`` in ``rest/assessments.js``.

REST templates
--------------

Document, study, and prompt templates (the ``template`` table). These are not
study templates, which are under ``/rest/v1/study-templates``. All routes need
``frontend.dashboard.templates.view``. The functions are in
``rest/templates.js``.

* ``GET /rest/v1/templates`` — the caller's own templates and public ones,
  without content.
* ``GET /rest/v1/templates/export`` — the caller's own templates with each saved
  language body, in the dashboard's export shape. ``?id=N`` exports one.
* ``POST /rest/v1/templates/import`` — what export returns
  (``{ "templates": [...] }``), an array of items, or one item.
  Creates each as a new private template owned by the caller. ``userId``,
  ``public``, and ``sourceId`` in the file are ignored. If one item is invalid,
  nothing is created.

Editing own templates (not email templates):

* ``POST /rest/v1/templates`` — ``{ "name", "description", "type", "defaultLanguage" }``,
  ``type`` 4 (document, general), 5 (document, study), or 8 (prompt). Starts
  without text.
* ``PATCH /rest/v1/templates/:id`` — ``name``, ``description``, ``defaultLanguage``.
* ``PUT /rest/v1/templates/:id/content/:language`` — the whole text of one
  language as a Quill delta (``{ "ops": [...] }``); adds the language if new.
  Unsaved dashboard drafts for that language are dropped, so the editor does not
  reapply old edits on top.
* ``DELETE /rest/v1/templates/:id/content/:language`` — remove a language (not
  the default one).
* ``POST /rest/v1/templates/:id/copy`` — copy another user's public template.
* ``DELETE /rest/v1/templates/:id``.

Email templates are system settings. They are never returned, created, or
changed over REST, whatever the token's rights. Placeholder definitions stay in
the dashboard.

REST submissions
----------------

The functions are in ``rest/submissions.js``. All routes need
``frontend.dashboard.submissions.view``.

* ``GET /rest/v1/submissions`` — the caller's submissions, or all with
  ``frontend.dashboard.assignments.viewAll`` on the token. Each comes with its
  ``documents`` (id, hash, name, type).
* ``GET /rest/v1/submissions/:id`` — one submission.
* ``DELETE /rest/v1/submissions/:id`` — soft-delete. Own submissions, or any
  with ``frontend.dashboard.assignments.replaceDeleteSubmissions``. Rejected
  when the assignment is closed or a document of the submission is used in a
  study.
* ``POST /rest/v1/submissions`` — upload a new submission. Multipart: one or more
  ``files``, ``assignmentId``, and optionally ``userId`` (for someone else, needs
  ``frontend.dashboard.assignments.uploadForOthers``), ``name``, ``description``.
  Without an assignment, ``validationConfigurationId`` (and optionally
  ``projectId``) instead. A ``projectId`` must be an own or public project
  (``400`` ``errors.rest.invalidProjectId``). At most 10 files (more are ignored) and 100 MB in
  total per request. The files are checked against the validation schema.
  With an assignment the caller must be able to see it, it must be open and not
  past its end, and the upload becomes the next revision within
  ``maxRevisions``. Without an assignment, an upload becomes the next version of
  the caller's latest submission in the same project (the given one, else the
  default project). After commit the assignment owner and the submitter get the
  usual emails, and the ``submission.uploaded`` trigger event fires. Counts as an
  expensive request. Same steps as the dashboard upload
  (``documentUploadSingleSubmission``); replacing an existing submission is not
  offered.

Assigning groups and publishing grades to Moodle are not in REST.

REST annotations and comments (read-only)
-----------------------------------------

* ``GET /rest/v1/documents/:idOrHash/annotations``
* ``GET /rest/v1/documents/:idOrHash/comments``

Both need ``frontend.dashboard.documents.view`` and access to the document.
With ``frontend.dashboard.studies.fullAccess`` on the token every note of the
document is returned. Otherwise the caller gets their own notes and the notes
made in sessions of studies they own. Drafts are never returned. On an
anonymous note that is not the caller's own, ``userId`` is ``null``. The
functions are ``listDocumentAnnotations`` and ``listDocumentComments`` in
``rest/notes.js``. Creating or changing notes
is not in REST.

REST lookups
------------

Read-only routes that return the ids other calls need.

* ``GET /rest/v1/me`` — any valid token. Returns
  ``{ "token": { "id", "name", "prefix", "createdAt", "lastUsedAt", "expiresAt" }, "user": { "id", "userName", "firstName", "lastName", "roles" }, "rights": [ ... ] }``.
  ``rights`` are the rights on the token that the owner still has, which is
  exactly what the token can use. ``lastUsedAt`` is updated at most once a
  minute per token.
* ``GET /rest/v1/study-templates`` — study templates the caller may create
  studies and assignments from: their own, or all with
  ``frontend.dashboard.studies.fullAccess`` on the token. Needs
  ``frontend.dashboard.studies.view``.
* ``GET /rest/v1/roles`` — role ids and names, for review-assignment mode ``byRole``.
  Any valid token.

The functions are ``listStudyTemplates`` in ``rest/studies.js``, ``listRoles``
in ``rest/users.js``, and ``describeToken`` in ``utils/apiTokenAuth.js``.

REST assignments
----------------

An assignment collects submissions (the ``assignment`` table, the dashboard's
Assignments page). Review assignments are a different thing, under ``/review-assignments``.
All routes need ``frontend.dashboard.assignments.view``. Functions are in
``rest/assignments.js``.

* ``GET /rest/v1/assignments`` and ``GET /rest/v1/assignments/:id`` — own
  assignments, those shared with the caller (by user or role), or all with
  ``frontend.dashboard.assignments.viewAll``. Each includes
  ``shareWith: { "roles": [ids], "users": [ids] }``.
* ``POST /rest/v1/assignments`` — the owner is the caller. Without ``projectId``
  the assignment goes into the caller's default project (own setting, else the
  system default), as in the dashboard. Fields: ``name``
  (required), ``description``, ``projectId``, ``start``, ``end``,
  ``maxRevisions`` (-1 for unlimited), ``validationConfigurationId`` (a
  validation configuration), ``allowReUpload``, ``notifyOnSubmissionUpload``,
  ``submissionWarning``, and ``shareWith`` with role ids or names and user ids.
* ``PATCH /rest/v1/assignments/:id`` — the same fields. A given ``shareWith``
  replaces the whole share list.
* ``POST /rest/v1/assignments/:id/close`` — no more uploads.
* ``DELETE /rest/v1/assignments/:id`` — only while it has no submissions
  (``errors.rest.assignmentHasSubmissions``); close it otherwise.

Changing, closing, and deleting work on own assignments, or any with
``frontend.dashboard.assignments.edit`` on the token, as in the dashboard.

REST projects
-------------

Functions are in ``rest/projects.js``.

* ``GET /rest/v1/projects`` and ``GET /rest/v1/projects/:id`` — own and public
  projects. Needs ``frontend.dashboard.projects.view`` or
  ``frontend.dashboard.documents.view``.
* ``POST /rest/v1/projects`` — ``{ "name", "description" }``, owned by the caller.
* ``PATCH /rest/v1/projects/:id`` — ``name``, ``description``, ``public: true``
  (publish; cannot be undone), ``closed: true|false``.
* ``DELETE /rest/v1/projects/:id`` — soft-delete. As in the dashboard, this also
  deletes the project's documents and studies.
* ``GET /rest/v1/me/project`` — the caller's current project, ``{ "project" }``:
  the one picked in the dashboard's project picker (``projects.default``), else
  the system default; ``null`` when there is none. New tag sets go there, and
  documents, assignments, and submissions sent without a ``projectId``.
* ``PUT /rest/v1/me/project`` — ``{ "projectId": 7 }`` makes that project current,
  the same setting the dashboard's picker writes. It must be an own or public
  project (``400`` ``errors.rest.invalidProjectId``); a missing or non-integer id
  is ``400`` ``errors.rest.invalidProjectField``. An open dashboard shows the new
  project after a reload. Both need the same right as reading projects.

Writes need ``frontend.dashboard.projects.view`` and work on own projects only.
Assigning users to a project stays in the dashboard.

REST tag sets
-------------

Functions are in ``rest/tags.js``. Reading needs
``frontend.dashboard.tags.view`` or ``frontend.dashboard.studies.view``; writing
needs ``frontend.dashboard.tags.view`` and works on own tag sets only.

* ``GET /rest/v1/tag-sets`` and ``GET /rest/v1/tag-sets/:id`` — own and public
  tag sets, each with its ``tags``.
* ``POST /rest/v1/tag-sets`` — ``{ "name", "description", "tags": [ { "name", "colorCode", "description" } ] }``.
  ``colorCode`` is one of ``success``, ``danger``, ``info``, ``dark``,
  ``warning``, ``secondary``. As in the dashboard, the set goes into the caller's
  current project: their own ``projects.default`` setting (the project picked in
  the dashboard), else the system ``projects.default``. A ``projectId`` in the
  body is ``400`` ``errors.rest.tagSetProjectNotSupported``.
* ``PATCH /rest/v1/tag-sets/:id`` — ``name``, ``description``, ``public: true``
  (publishes the set and its tags; cannot be undone), and ``tags``: entries with
  an ``id`` change that tag, entries without one are added, tags left out are
  deleted.
* ``DELETE /rest/v1/tag-sets/:id`` — deletes the set and its tags.

REST workflows
--------------

Functions are in ``rest/workflows.js``. Reading needs
``frontend.dashboard.workflows.view`` or ``frontend.dashboard.studies.view``;
writing needs ``frontend.dashboard.workflows.view`` and works on own workflows.

* ``GET /rest/v1/workflows`` and ``GET /rest/v1/workflows/:id`` — workflows with
  their ``steps`` in order. A step ``id`` is what ``stepDocuments`` and
  ``workflowMapping`` refer to.
* ``POST /rest/v1/workflows/:id/copy`` — ``{ "name" }`` optional. Copies the
  workflow and its steps; the caller owns the copy.
* ``POST /rest/v1/workflows/import`` — the dashboard's workflow export file (one
  item, an array, or ``{ "workflows": [...] }``), each with ``workflow_step`` (or
  ``steps``). Expensive request.
* ``PATCH /rest/v1/workflows/:id`` — ``name``, ``description``, ``hideInFrontend``.
* ``PUT /rest/v1/workflows/:id/steps`` — ``{ "steps": [...] }`` replaces all steps,
  only while no study or study template uses the workflow
  (``errors.rest.workflowInUse``); copy it otherwise.
* ``DELETE /rest/v1/workflows/:id`` — only while unused.

A step is ``{ "name", "stepType", "allowBackward", "configuration", "documentFromStep" }``:
``stepType`` 1 annotator, 2 editor, 3 modal, 4 dialogue; ``documentFromStep`` is
the 1-based position of an earlier step whose document this step shows. Import
ignores ``workflowStepDocument`` from the file, because the export drops step
ids and those values point at steps of the source database.

REST configurations
-------------------

Assessment rubrics and criteria, validation schemas, and dialogue plans.
Functions are in ``rest/configurations.js``.

* ``GET /rest/v1/configurations`` and ``GET /rest/v1/configurations/:id`` —
  any valid token: configurations that are not hidden, and the caller's own.
* ``POST /rest/v1/configurations`` — ``{ "name", "description", "type", "content", "hideInFrontend" }``,
  ``type`` is ``assessment``, ``validation``, or ``dialoguePlan`` (or 0, 1, 2).
* ``PATCH /rest/v1/configurations/:id`` — ``name``, ``description``, ``content``,
  ``hideInFrontend``.
* ``DELETE /rest/v1/configurations/:id`` — only while no assignment, submission,
  or study step uses it.

Writing needs ``frontend.dashboard.configurations.manage`` and works on own
configurations. That right is granted to admins only, matching the dashboard,
where creating configurations is admin-only; only the REST API checks it. Content is checked by type: an assessment needs ``rubrics``, each with a
``name`` and ``criteria``, each criterion with a ``name`` and ``minPoints`` not
above ``maxPoints``; a validation needs a ``rules`` object; a dialogue plan any
object. Other keys are kept, so files exported from the dashboard stay valid.

REST users
----------

* ``GET /rest/v1/users?email=a@x.org,b@x.org`` or ``?extId=17,18`` — look up
  users by exact email or external id, at most 100 keys per request. Returns
  ``{ "users": [ { "id", "firstName", "lastName", "roles" } ] }``, plus the
  ``email`` or ``extId`` the caller asked with.

There is no route that lists all users. A request without ``email`` or
``extId`` is ``400``. A user is returned only when the token and its owner hold
``backend.socket.user.getUsers.<role>`` for one of that user's roles, or
``backend.socket.user.getUsers.all``. Users the caller may not see are left out
without an error. The function is ``findUsers`` in ``rest/users.js``.

The token is rejected if the owner is guest-only, even if the key still exists.

Error keys live under ``errors.rest.*`` in ``utils/modules/i18n/*/errors.json``.
