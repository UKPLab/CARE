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
fields. Create and upload call the same application functions as the document
sockets (``createDocument``, ``addDocument``). Socket ``emit`` is not used on
REST.

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

The token is rejected if the owner is guest-only, even if the key still exists.

Error keys live under ``errors.rest.*`` in ``utils/modules/i18n/*/errors.json``.
