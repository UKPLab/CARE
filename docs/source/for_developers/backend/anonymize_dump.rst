Anonymized Database Dump
========================

The ``anonymize_dump`` make target produces a sanitized copy of a CARE database dump that is safe to share with collaborators or to use in research publications. The original database is never modified.

The dump contains all data belonging to users who gave consent (``acceptDataSharing = true``), with their personal information replaced by realistic pseudonyms. All data belonging to non-consenting users is removed. Auth secrets are wiped on every account so the dump cannot be used to log in.

Usage
-----

.. code-block:: bash

    make anonymize_dump \
        CONTAINER=<container-name-or-id> \
        DUMP=<filename-inside-db_dumps>

The output file is written to ``db_dumps/anonymized_<timestamp>.sql``. The admin email is read from ``ADMIN_EMAIL`` in your ``.env`` file. You will be prompted to enter a new admin password interactively during the process.

**Optional parameters:**

``SEED=<integer>`` — seed the Faker RNG so pseudonyms are reproducible across runs.

``NUM=<integer>`` — after removing non-consenting users, randomly retain only ``NUM`` consenting users and remove the rest. Combine with ``SEED`` for a deterministic subset.

Pipeline steps
--------------

The target runs the following steps against a temporary sidecar database so the live ``care`` database is never touched.

1. **Create sidecar DB** — a fresh database is created inside the container.
2. **Restore dump** — the source dump is piped into the sidecar database.
3. **Migrate schema** — any pending Sequelize migrations are applied.
4. **Anonymize** —

   - *Phase A* — hard-delete all rows belonging to non-consenting users across every affected table, then reassign ownership of shared resources (projects, studies, documents, …) to the admin account.
   - *Phase A.2* — safety net: any ``userId`` integer column not covered by a Sequelize association is cleaned up automatically and a warning is logged.
   - *Phase B* — replace PII on surviving users with Faker-generated values. Columns are read from ``User.accessMap`` so future PII additions are picked up automatically.
   - *Phase C* — set all auth-secret columns (``passwordHash``, ``salt``, ``resetToken``, …) to ``'ANONYMIZED'`` on every account.

5. **Reset admin password** — the admin password is set interactively. The admin's email and data are preserved throughout.
6. **Export** — ``pg_dump`` writes the sidecar database to ``db_dumps/anonymized_<timestamp>.sql``. Then all document files referenced by surviving records are collected from the local ``files/`` directory and zipped into ``db_dumps/anonymized_<timestamp>_files.zip``.
7. **Drop sidecar DB** — the temporary database is removed.

Loading the dump
----------------

The target produces two output files in ``db_dumps/``:

- ``anonymized_<timestamp>.sql`` — the anonymized database dump.
- ``anonymized_<timestamp>_files.zip`` — the document files referenced by surviving records.

To load the dump into an existing CARE instance, place the SQL file in ``db_dumps/`` and use the standard recovery command:

.. code-block:: bash

    make recover_db CONTAINER=<container-name-or-id> DUMP=anonymized_<timestamp>.sql

If you need to regenerate the files archive from an existing anonymized SQL dump without re-running the full pipeline, use:

.. code-block:: bash

    make export_dump_files CONTAINER=<container-name-or-id> DUMP=anonymized_<timestamp>.sql

Then extract the files archive into the ``files/`` directory of the target instance:

.. code-block:: bash

    unzip -o db_dumps/anonymized_<timestamp>_files.zip -d files/

.. warning::

   ``recover_db`` will override the current database state of the target container.

What is kept
------------

- ``acceptDataSharing`` and ``acceptedAt`` — preserved as proof of consent.
- Study structure: workflows, steps, tag sets, templates, configurations.
- Consenting users' annotations, comments, sessions, and assignments.

Limitations
-----------

.. warning::

   Free-text fields (annotation text, comment text, document content) may still contain personally identifiable information typed in by participants. A manual review of free-text content is recommended before sharing the dump externally.

The ``--num`` subset reduction picks users at random and does not guarantee that every retained user has a minimum number of annotations or sessions.

Keeping the pipeline up to date
--------------------------------

The anonymize script uses Sequelize associations to locate every row belonging to a given user. When you add a migration that introduces a new table or column referencing ``user``, the corresponding ``static associate()`` block must be added or updated so the pipeline can reach it.
