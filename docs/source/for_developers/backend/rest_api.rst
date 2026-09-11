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

REST paths (this slice)
-----------------------

* ``GET /rest/v1/documents`` — documents owned by the key owner.
  Needs token right ``frontend.dashboard.documents.view``.
* ``POST /rest/v1/documents`` — blank HTML document (``type`` 1). Body
  ``{ "name": "..." }``. ``uploadedByUserId`` stays null (same as UI Create).
  Other ``type`` values are rejected.

The token is rejected if the owner is guest-only, even if the key still exists.

Error keys live under ``errors.rest.*`` in ``utils/modules/i18n/*/errors.json``.
