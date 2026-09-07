Interface Language
==================

CARE can show menus, buttons, and messages in more than one language (for example **English** and **German**).
This page explains what that setting does and how to use it.

What changes when you switch language
-------------------------------------

When you choose a language in **Preferences**, CARE translates the parts of the app that are built in:

* Menu items and page titles
* Button labels (Save, Cancel, …)
* Form labels and placeholders
* Short messages such as success or error toasts

Your choice is saved to your account, so you keep the same language the next time you log in.

What does **not** change
------------------------

Switching the interface language does **not** translate content that you or others created:

* Study names, document titles, usernames, workflow names
* Text inside email or document **templates** (those have their own language versions)

.. note::

   **Interface language** and **template language** are two different things.

   * **Interface language** — labels like “Settings” or “Save”.
   * **Template language** — the actual text of an email or document template (e.g. an English version and a German version).

   Changing your interface language to German does **not** automatically change which template text is sent.
   Template languages are managed separately under **Dashboard → Templates**.

How to change your language
---------------------------

1. Open **Preferences** (from the dashboard or your profile menu).
2. In the **Language** section, choose **English**, **Deutsch**, or another language offered by your instance.
3. Click **Save**.

Most of the interface updates right away. If a label does not update immediately, try refreshing the page.

Before you log in
-----------------

On the login, registration, and password-reset pages, CARE tries to match your **browser language**.
If that language is not available, English is used.

After you log in, your saved preference from **Preferences** takes over.

Which languages are available?
------------------------------

That depends on how your CARE instance was set up. Common options are **English** and **German**.
If a translation for a particular label is missing, you may see English text or a short technical label as a fallback.

Restricting who can change the language
---------------------------------------

On most instances, every logged-in user can pick a language in **Preferences** (see above).

Administrators can **turn off the language switcher** for selected roles by assigning a user right whose
description is **“disables the ability to change the UI language in preferences”**.

**What affected users see**

* The **Language** block in **Preferences** is hidden — there is no dropdown to switch English / Deutsch.
* They cannot save a different UI language themselves.
* The interface still appears in a language: the instance default, the browser language before login, or a
  language an administrator set for their account.

**Why use this**

* Keep a study or course on **one interface language** so all participants see the same menu labels and buttons.
* Avoid confusion when template content is in one language but menus could be switched independently.

**Who is affected by default**

New installations often assign this right to the **Guest** role, so guest accounts cannot change the
language. Other roles (e.g. teachers, reviewers) usually keep the switcher unless an administrator adds the
same right to their role.

**How administrators change it**

1. Open the **Users** area on the dashboard (admin access required).
2. Manage **roles** and **rights** — add or remove the right above from the roles that should *not* be able
   to change language.
3. Users need to open **Preferences** again (or refresh) for the change to take effect.

Administrators can still set a user's language when needed; the restriction applies to self-service changes
in **Preferences**.

See also
--------

* :doc:`templates` — creating and managing email and document templates
* :doc:`basics` — getting started with CARE
