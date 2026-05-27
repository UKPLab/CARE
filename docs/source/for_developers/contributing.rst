Open-Source Contributor Guide
=============================

**Who this is for:** External developers who want to contribute to CARE, whether you found a bug,
want to improve the docs, propose a feature, or simply want to work on a meaningful research platform.


Step 1: Understand the Product First
------------------------------------

Before touching any code, use the product. Visit the
`live demo <https://demo.care.ukp.informatik.tu-darmstadt.de>`_ or
:doc:`run it locally <before_you_start>`. Try both sides:

* **Researcher side** — log in and explore the dashboard. A good starting path is:

  #. **Upload a document** (Dashboard → *Documents* → add a new document).
  #. **Create a study** on top of that document (Dashboard → *Studies* → add a new study, use the **Peer Review** workflow).


* **Participant side** :

  #. Start the study as a participant.
  #. Go through the **annotator** step.
  #. Then continue with the **editor** step.

For more detail, see :doc:`../for_researchers/basics`.

Step 2: What to Work on
-----------------------

Issues
~~~~~~

You can create an issue when:

* You found a concrete bug you can describe clearly
* You have a specific, well-defined feature request
* You want to propose a documentation improvement with defined scope

Do not open vague issues. If you do not have a specific well-defined issue in mind, browse open issues
available for newcomers under the ``good first issue`` label. Moreover, before
starting work on an issue, comment on it to signal your intent.

Issue Templates
~~~~~~~~~~~~~~~

There are different types of issues you would like to create. Each has a specific template that you
need to follow and are pre-defined once you create a new issue. You can read examples of similar
issues in the `CARE issue tracker <https://github.com/UKPLab/CARE/issues>`_, filtered by the
available *types*.

Once you decide what issue you are going to work on, follow the steps below.

Step 3: Fork and Clone the Repository
-------------------------------------

As an external contributor you cannot push directly to the CARE repository.

Fork
~~~~

* Go to the `repository <https://github.com/UKPLab/CARE>`_
* Click the **Fork** button
* Choose your GitHub account

You now have a copy at ``https://github.com/YOUR_USERNAME/CARE``.

Clone your fork
~~~~~~~~~~~~~~~

.. code-block:: bash

    git clone https://github.com/YOUR_USERNAME/CARE.git
    cd CARE

Add the upstream remote
~~~~~~~~~~~~~~~~~~~~~~~

This links your local repository to the official CARE repository so you can pull future updates:

.. code-block:: bash

    git remote add upstream https://github.com/UKPLab/CARE.git

Verify your remotes:

.. code-block:: bash

    git remote -v

You should see:

.. code-block:: text

    origin    https://github.com/YOUR_USERNAME/CARE.git (fetch)
    origin    https://github.com/YOUR_USERNAME/CARE.git (push)
    upstream  https://github.com/UKPLab/CARE.git (fetch)
    upstream  https://github.com/UKPLab/CARE.git (push)

* ``origin`` is your fork, you push here.
* ``upstream`` is the official repo, you pull from here.

.. note::

    A detailed guidance is available on official guideline
    `forking guide <https://docs.github.com/en/get-started/quickstart/contributing-to-projects>`_
    for more on contributing through forks.

Step 4: Run CARE Locally
------------------------

Follow the official guide: :doc:`before_you_start`.

Step 5: Git Workflow for External Contributors
----------------------------------------------

Branch structure
~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Branch
     - Purpose
   * - ``main``
     - Stable, production-ready. Protected. Maintainers only.
   * - ``dev``
     - Active development. Protected. All contributions target here.
   * - ``feat-*``
     - Your feature branches, created from ``dev``, merged back to ``dev`` via PR.
   * - ``hotfix-*``
     - Urgent bug fixes, created from ``main``, merged back to ``main``.

You always work on a branch, never directly on ``dev``.

Starting work on a new contribution
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

First, make sure your local ``dev`` is up to date with upstream:

.. code-block:: bash

    git fetch upstream
    git checkout dev
    git merge upstream/dev

Then create your branch:

.. code-block:: bash

    git checkout -b feat-ISSUENUMBER-short-description dev

Branch naming conventions
~~~~~~~~~~~~~~~~~~~~~~~~~

.. list-table::
   :header-rows: 1
   :widths: 20 40 40

   * - Type
     - Pattern
     - Example
   * - Feature
     - ``feat-ISSUENUMBER-shortname``
     - ``feat-42-add-csv-export``
   * - Bug fix
     - ``fix-ISSUENUMBER-shortname``
     - ``fix-87-login-redirect``
   * - Documentation
     - ``docs-ISSUENUMBER-shortname``
     - ``docs-12-update-setup-guide``
   * - Hotfix
     - ``hotfix-ISSUENUMBER``
     - ``hotfix-99-session-crash``

Use dashes to separate parts. Keep names short and descriptive. Always include the issue number.

Commit message format
~~~~~~~~~~~~~~~~~~~~~

.. code-block:: text

    <type>: <short description in present tense>

.. list-table::
   :header-rows: 1
   :widths: 20 80

   * - Type
     - Use for
   * - ``feat``
     - New feature
   * - ``fix``
     - Bug fix
   * - ``refactor``
     - Code restructuring with no behavior change
   * - ``docs``
     - Documentation only
   * - ``test``
     - Tests only
   * - ``style``
     - Formatting, whitespace
   * - ``ci``
     - CI configuration
   * - ``chore``
     - Build scripts, dependencies, maintenance

**Rules:**

* Present tense: "add" not "added"
* Lowercase
* No period at the end
* One logical change per commit
* A commit should represent at most one day of work

**Good:** ``fix: resolve null check in document save handler``

**Bad:** ``fixed stuff`` / ``WIP`` / ``changes`` / ``update``

Pushing to your fork
~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

    git push
    # First push: git push --set-upstream origin feat-ISSUENUMBER-short-description

Push to ``origin`` (your fork), never to ``upstream``.

Keeping your branch up to date
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If ``dev`` has moved forward since you started your branch, sync before opening a PR:

.. code-block:: bash

    git fetch upstream
    git checkout dev
    git merge upstream/dev
    git checkout feat-ISSUENUMBER-short-description
    git merge dev
    git push

.. warning::

    Do not squash commits — the team has found that squashed commits cause merge conflicts in
    downstream branches. Keep individual commits intact.

Step 6: Opening a Pull Request
------------------------------

Before opening
~~~~~~~~~~~~~~

.. code-block:: bash

    git fetch upstream
    git checkout dev
    git merge upstream/dev
    git checkout your-branch
    git merge dev
    git push

PR title format
~~~~~~~~~~~~~~~

PR title should include the type, followed by the issue number, and then a short description of the issue.

**Format:** ``<Type> <ISSUE_NUMBER> <short description>``

**Example:** ``Feat 54 add active users monitoring``

PR description template
~~~~~~~~~~~~~~~~~~~~~~~

For the body, follow this template:

.. code-block:: markdown

    ## Summary
    Short summary describing what this PR does

    ## New User Features
    - List user-facing features introduced in this PR.

    ## New Dev Features
    - List developer-facing changes (tooling, configs, architecture)

    ## Improvements
    - List non-breaking improvements (refactors, consistency fixes, optimizations)

    ## Bug Fixes
    - List bugs fixed, include rule names / modules if relevant

    ## Known Limitations
    - List any known issues, incomplete work, or trade-offs, if any.

    ## Future Steps
    - List follow-up work, additional PRs, or planned improvements

Step 7: Navigating Code Review
------------------------------

How to respond
~~~~~~~~~~~~~~

.. code-block:: bash

    git add .
    git commit -m "fix: address review comments"
    git push

Reply to each thread with:

.. code-block:: text

    Resolved in commit <hash>

Step 8: Staying in Sync
-----------------------

As CARE continues to develop, your fork will fall behind upstream. Sync regularly, especially
before starting new work:

.. code-block:: bash

    git fetch upstream
    git checkout dev
    git merge upstream/dev
    git checkout feat-branch
    git merge dev
    git push
