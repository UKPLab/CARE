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

Each token has an hourly request budget (currently 100; the final number is not
chosen yet). Once a token uses it up, further requests in that hour return
``429`` with ``errors.rest.rateLimitExceeded``. Every response carries
``RateLimit`` and ``RateLimit-Policy`` headers with the remaining count. Tokens
are counted separately, even for the same user.

Cookie paths
------------

* ``GET /auth/api-tokens`` — own tokens. Admins see all (including ``userId``).
* ``POST /auth/api-tokens`` — body ``{ "name": "..." }``. Optional ``rights``
  array; default is every right the owner can attach. Guest-only accounts cannot
  create keys.
* ``DELETE /auth/api-tokens/:id`` — owner or admin. Non-admins cannot revoke
  another user's key.

REST documents
--------------

Needs token right ``frontend.dashboard.documents.view``. The ``:idOrHash``
parameter accepts the numeric id or the document hash. List JSON includes both
fields. The routes call REST-only functions exported from
``sockets/document.js`` (``createDocument``, ``addDocument``, ...). The socket
methods are separate and unchanged. Socket ``emit`` is not used on REST.

* ``GET /rest/v1/documents`` — list. Same visibility as the UI: an admin token
  sees all documents; other tokens see the owner's documents.
* ``POST /rest/v1/documents`` — JSON. Blank HTML (``type`` 1, default) or modal
  (``type`` 2). Body ``{ "name": "..." }``. Optional ``projectId``,
  ``templateId``. ``uploadedByUserId`` stays null (same as UI Create). PDF/ZIP
  types are rejected here.
* ``POST /rest/v1/documents/upload`` — multipart field ``file`` (``.pdf``,
  ``.zip``, ``.delta``). Same as UI Upload (``addDocument``).
* ``GET /rest/v1/documents/:idOrHash`` — one document as JSON.
* ``PATCH /rest/v1/documents/:idOrHash`` — ``name`` and/or ``public`` (publish is
  ``{ "public": true }``).
* ``DELETE /rest/v1/documents/:idOrHash`` — dashboard soft-delete.
* ``GET /rest/v1/documents/:idOrHash/upload`` — PDF or ZIP bytes. HTML/modal
  return ``errors.rest.documentHasNoBinaryFile``.
* ``PUT /rest/v1/documents/:idOrHash/upload`` — replace PDF/ZIP bytes (admin,
  same as UI replace). Id and hash stay the same.

Missing document: ``404`` ``errors.rest.documentNotFound``. Document exists but
the token must not see or change it: ``403`` ``errors.rest.documentNoAccess``.

REST studies
------------

List and get need token right ``frontend.dashboard.studies.view``. Create,
patch, open, close, delete, template, import, and export need
``frontend.dashboard.studies.canManageStudies``. The ``:idOrHash`` parameter
accepts the numeric id or the study hash. List JSON includes both fields.
The routes call REST-only functions exported from ``sockets/study.js``. The
socket methods are separate and unchanged. Socket ``emit`` is not used on REST.
Live bulk progress stays on the socket.

* ``GET /rest/v1/studies`` — list. Same visibility as the studies table: not
  templates, limited to the caller's default project when that setting is set.
  An admin token sees those studies. Other tokens see studies they created.
* ``GET /rest/v1/studies/:idOrHash`` — one study as JSON. A template is not
  part of this list, so it is ``403``.
* ``POST /rest/v1/studies`` — create from a study template via ``study.add``.
  Body ``{ "templateId": 1 }`` plus any fields the create form sends (``name``,
  ``description``, ``workflowId``, ``tagSetId``, limits, dates, switches,
  ``stepDocuments``). ``userId`` in the body is ignored.
* ``PATCH /rest/v1/studies/:idOrHash`` — those same fields. A closed study or a
  template is rejected.
* ``POST /rest/v1/studies/:idOrHash/close`` — close one study. Optional
  ``{ "notifySessions": true }`` sends the existing close emails.
* ``POST /rest/v1/studies/:idOrHash/open`` — reopen one study (``closed``
  cleared, same as Restart).
* ``DELETE /rest/v1/studies/:idOrHash`` — soft-delete via ``deleteById``.
* ``POST /rest/v1/studies/close`` — body ``{ "ids": [1, 2], "notifySessions": false }``.
* ``POST /rest/v1/studies/open`` — body ``{ "ids": [1, 2] }``.
* ``POST /rest/v1/studies/delete`` — body ``{ "ids": [1, 2] }``.
  Open, close, and delete each call one function. The item route passes a
  single id. The bulk route passes the array.
* ``POST /rest/v1/studies/:idOrHash/template`` — save that study as a template
  (``studySaveAsTemplate``).
* ``GET /rest/v1/studies/:idOrHash/export?format=json`` — the study plus
  ``study_step`` rows, JSON or ``format=yaml``. Same shape as the dashboard
  export modal.
* ``POST /rest/v1/studies/import`` — that same JSON array, or
  ``{ "format": "yaml", "content": "..." }``. Creates templates the way the
  dashboard import does (``studySaveAsTemplate`` with ``onlyTemplate``).

Missing study: ``404`` ``errors.rest.studyNotFound``. Study exists but the
token must not see or change it: ``403`` ``errors.rest.studyNoAccess``.

Sessions, assignments, subscribe, and the live bulk progress channel are not
in this slice.

The token is rejected if the owner is guest-only, even if the key still exists.

Error keys live under ``errors.rest.*`` in ``utils/modules/i18n/*/errors.json``.
