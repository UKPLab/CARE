Socket Profiler
===============

The Socket Profiler records the WebSocket traffic of a live CARE session and replays it later against
a running server. It exists to answer two questions that otherwise require manual clicking:

- **Does this build still work?** Replay a suite of recorded user stories and see which ones break.
- **How does the server behave under load?** Replay the same sessions repeatedly and concurrently,
  and observe latency, memory, the database connection pool and Postgres counters.

The feature has two halves: an admin dashboard page for capturing and managing recordings, and a
command line tool for replaying them.

Recordings are stored in the database and can be exported to JSON, which makes them portable between
installations and suitable for checking into the repository as regression fixtures.

Recording
---------

Starting a recording
~~~~~~~~~~~~~~~~~~~~

The Socket Profiler page is located in the admin section of the dashboard. Recording is server-wide:
the recorder attaches catch-all listeners across sockets rather than to a single connection.

To capture a session, the administrator opens the Socket Profiler page, starts a recording, names it
and selects the active session to capture. A recording bar is displayed across the dashboard for as
long as the capture runs.

.. note::

    Because capture is server-wide, the administrator normally works in two browser tabs: one driving
    the application, one holding the Socket Profiler page. The session selected in the dialog is the
    one whose traffic is captured, not the tab the profiler is open in.

Stopping a recording
~~~~~~~~~~~~~~~~~~~~

Stopping the capture opens a review dialog. The recording is already stopped at that point — the
dialog is a review and naming step, not a confirmation step.

In the dialog the administrator can rename the recording and deselect individual traces, which
soft-deletes them. The *recorderStart* and *recorderStop* traces are deselected by default, since
they are artefacts of the recording process rather than application behaviour.

Exporting and importing
~~~~~~~~~~~~~~~~~~~~~~~

A recording can be exported to a JSON file from the recordings table. The exported file contains the
full trace list, including any file bytes uploaded during the session. This makes each recording
self-contained, at the cost of size: a story containing a PDF upload can reach several megabytes.

Import is handled by the *recorderImport* socket event, which runs inside a transaction so that a
partially imported recording cannot be left behind.

What a trace contains
~~~~~~~~~~~~~~~~~~~~~

.. list-table::
    :header-rows: 1

    * - Field
      - Description
    * - **action**
      - The socket event name, for example *documentAdd*
    * - **payload**
      - The event payload, stored as JSONB
    * - **direction**
      - *true* for frontend to backend, *false* for backend to frontend
    * - **startTime** / **endTime**
      - Capture timestamps
    * - **recordingId**
      - The owning recording

Only incoming traces are replayed. Outgoing traces are captured for diagnosis — they are what makes
it possible to observe, for example, that a view tears down subscriptions it never established.

.. note::

    Buffers do not survive a JSON round trip intact. The *reviveBuffers* helper in
    ``backend/utils/replay-sessions.js`` restores them before replay, which is what makes recorded
    file uploads replayable.

The command line tool
---------------------

The tool is run from the ``backend`` directory:

.. code-block:: bash

    npm run perf -- --mode <mode> <source> [options]

Everything after ``--`` is passed to ``backend/scripts/perf/cli.js``.

Authentication
~~~~~~~~~~~~~~

The tool logs in as an administrator over HTTP, then opens a Socket.IO connection using the resulting
session cookie. A password is mandatory; the run aborts before contacting the server if none is
found. The password is resolved from ``--password``, then *PERF_ADMIN_PASSWORD*, then *ADMIN_PWD*.

The user defaults to *admin* and can be overridden with ``--user`` or *PERF_ADMIN_USER*.

.. note::

    In a standard local setup *ADMIN_PWD* is already present in the **.env** file in the root
    directory, so no additional configuration is required.

Choosing what to replay
~~~~~~~~~~~~~~~~~~~~~~~

Every run requires at least one source:

.. list-table::
    :header-rows: 1

    * - Option
      - Source
    * - ``--recordings 12,15``
      - Recordings already present in the target database, by id
    * - ``--files a.json,b.json``
      - Exported JSON files, by path
    * - ``--dir stories/``
      - Every JSON file in a folder

File-based sources are read directly and do not need to be imported into the database first.

When replaying files, each session is executed as the user who was recorded, resolved against the
target database — not as the administrator running the tool. A session whose recorded user cannot be
found in the target database is reported as a failure rather than silently skipped.

Modes
~~~~~

Five modes are available, selected with ``--mode``. The default is *ramp*.

**regression** replays each session once, sequentially, and requires every trace to succeed. This is
the mode used before a deployment.

.. code-block:: bash

    npm run perf -- --mode regression --dir tests/regression_stories/

Sequential replay is what makes the ids assigned during a run deterministic, so that a story creating
a document and a later story referencing it remain consistent.

Results are grouped per story, followed by a trace breakdown across the whole run. Traces that
received no acknowledgement are reported separately from traces the server actively rejected; the two
are indistinguishable at the socket level but mean very different things.

**inspect** reads recordings without replaying them and reports what they contain. Nothing is emitted
to the server and no database state changes.

.. code-block:: bash

    npm run perf -- --mode inspect --files tests/regression_stories/030-upload-document.json

The distribution is reported plainly over every action present. No trace type is filtered out and the
mode reaches no verdict about whether a recording is useful — that judgement belongs to the developer
reading it.

The distinction that matters when reviewing a newly captured story is incoming against outgoing. Only
incoming traces are replayed; a recording whose incoming traces consist solely of telemetry and
subscription events contains no behaviour and should not be added to the regression suite.

**ramp** replays the sessions repeatedly with increasing concurrency and reports latency, memory,
database pool and Postgres statistics at each step.

.. code-block:: bash

    npm run perf -- --mode ramp --recordings 12,15 --max-iterations 30

**ceiling** increases concurrency until a stop condition trips, then reports the highest concurrency
the server sustained.

.. code-block:: bash

    npm run perf -- --mode ceiling --recordings 12 --step 5 --latency-threshold 1000

**soak** holds a fixed concurrency for a fixed duration and watches for drift: memory growth, pool
exhaustion, rising latency.

.. code-block:: bash

    npm run perf -- --mode soak --recordings 12 --concurrency 10 --duration 30m

Soak additionally correlates memory growth against the trace types active in each sampling window.

.. note::

    The memory correlation is a lead, not proof. True per-trace memory attribution requires heap
    snapshots, which distort the measurement they are taken from.

Option reference
~~~~~~~~~~~~~~~~

.. list-table::
    :header-rows: 1

    * - Option
      - Default
      - Modes
      - Description
    * - ``--mode``
      - *ramp*
      - all
      - One of *ramp*, *ceiling*, *soak*, *regression*, *inspect*
    * - ``--recordings``
      - —
      - all
      - Comma-separated recording ids from the database
    * - ``--files``
      - —
      - all
      - Comma-separated paths to exported JSON files
    * - ``--dir``
      - —
      - all
      - Folder of exported JSON files
    * - ``--server``
      - *http://localhost:3001*
      - all
      - Target server
    * - ``--user``
      - *admin*
      - all
      - Administrator login
    * - ``--password``
      - —
      - all
      - Administrator password
    * - ``--timing-mode``
      - *fast*
      - all
      - *fast* replays without the original gaps, *realtime* preserves them
    * - ``--ack-timeout``
      - *2000*
      - ramp, ceiling, soak, regression
      - Milliseconds to wait for a trace acknowledgement
    * - ``--latency-threshold``
      - *1000*
      - ramp, ceiling
      - Latency in ms treated as a breach
    * - ``--max-iterations``
      - *10*
      - ramp, ceiling
      - Iteration limit
    * - ``--continue-on-failure``
      - *false*
      - ramp
      - Keep replaying after a failing trace
    * - ``--step``
      - *5*
      - ceiling
      - Concurrency increment per level
    * - ``--max-failures``
      - *0*
      - ceiling
      - Absolute failure count tolerated per level
    * - ``--fail-threshold``
      - *5*
      - ceiling
      - Failure percentage tolerated per level
    * - ``--concurrency``
      - *10*
      - soak
      - Sessions replayed in parallel
    * - ``--duration``
      - *60s*
      - soak
      - Run length, accepts *30s*, *5m*, *1h*
    * - ``--sample-interval``
      - *0*
      - soak
      - Gap between iterations, *0* means back-to-back

The *inspect* mode reads no options beyond the source flags, since it does not replay.

.. note::

    The *regression* mode always replays every story and reports each result rather than stopping at
    the first failure. This is deliberate and not configurable: a run that aborts early reports one
    broken story and says nothing about the rest.

Ceiling has two failure conditions that work together. ``--max-failures`` is an absolute count and
``--fail-threshold`` a percentage; a level trips if either is exceeded. With the default
``--max-failures 0`` any failure stops the run, so the percentage never applies. The rate condition
becomes meaningful once some failures are tolerated, for example ``--max-failures 5
--fail-threshold 2``, which allows up to five failures per level but stops early if more than two
percent of traces fail.

Reading the output
~~~~~~~~~~~~~~~~~~

Every run prints a per-action breakdown:

.. code-block:: text

    action          count  fail  ok%  minMs  p50  avgMs  p95Ms  maxMs  totalMs  dbW

.. list-table::
    :header-rows: 1

    * - Column
      - Description
    * - **action**
      - Socket event name
    * - **count**
      - Times this action was replayed
    * - **fail**
      - How many of those failed
    * - **ok%**
      - Success percentage
    * - **minMs, p50, avgMs, p95Ms, maxMs**
      - Latency distribution
    * - **totalMs**
      - Cumulative time spent in this action
    * - **dbW**
      - Database writes attributed to this action

.. note::

    The 95th percentile is usually more informative than the average. An average hides a small number
    of very slow calls, which are exactly the ones users notice.

Saved results
~~~~~~~~~~~~~

Each run writes two files to ``backend/logs/perf/``: a timestamped **.json** file containing raw
machine-readable data, and a **.txt** file containing the terminal output verbatim. The text file is
byte-identical to what appeared on screen, so a run can be attached to an issue without repeating it.

The regression suite
--------------------

The suite is a folder of exported recordings, one per user story, located at
``backend/tests/regression_stories/`` and replayed in order:

.. code-block:: bash

    npm run perf -- --mode regression --dir tests/regression_stories/

.. note::

    The stories are stored alongside CARE's Jest tests but are not part of them. The ``make test``
    target matches ``*.test.js`` and recreates its own test database; it neither reads nor runs these
    files. The suite is a separate pre-deployment check against a running server.

Each file is named so that alphabetical order is replay order, numbered in tens so that further
stories can be inserted without renaming the whole set:

.. code-block:: text

    010-...                 first
    020-...
    ...
    990-delete-document     last

Rules for a replayable story
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

**Self-contained.** A story should create whatever it needs rather than referencing something an
earlier story produced, wherever that is practical. Cross-story dependencies work but are fragile.

**Fresh database.** The suite is single-use per database. Stories create rows; replaying them a
second time produces unique constraint violations, revision limits and "already exists" errors. The
database is rebuilt before each run with ``make clean`` followed by ``make init``.

**Stable references only.** Only seeded ids are safe to reference:

.. list-table::
    :header-rows: 1

    * - Entity
      - Id
    * - Bot, guest and admin users
      - 2, 3, 4
    * - Showcase Document
      - 1
    * - Workflows
      - 1 to 8
    * - Workflow steps
      - 1 to 19

**Destructive stories sort last.** A story that deletes a record is numbered so that it runs after
everything depending on that record.

**Record against the state the story will replay into.** The most common cause of a story that passes
when recorded and fails on replay is that it was captured against a database holding far more rows
than a replay produces. Recording against a freshly replayed database avoids this.

Adding a story
~~~~~~~~~~~~~~

1. Rebuild the database and replay the existing suite, so that the state matches what the new story
   will encounter at its position in the run.
2. Record the story through the dashboard.
3. Inspect it and confirm it contains a real mutation.
4. Place it in the suite folder with a number that positions it correctly.
5. Rebuild the database and run the whole suite.

Architecture
------------

.. list-table::
    :header-rows: 1

    * - Component
      - Path
      - Role
    * - Recorder socket
      - ``backend/webserver/sockets/recorder.js``
      - Catch-all listeners, writes traces
    * - Replayer socket
      - ``backend/webserver/sockets/replayer.js``
      - Drives replay from the server side
    * - Replay authentication
      - ``backend/utils/replay-auth.js``
      - Establishes a session for the recorded user
    * - Session helpers
      - ``backend/utils/replay-sessions.js``
      - Trace grouping, session building, buffer revival
    * - Replay worker
      - ``backend/utils/replay-worker.js``
      - Emits traces and collects acknowledgements
    * - Command line entry point
      - ``backend/scripts/perf/cli.js``
      - Argument parsing, configuration validation, mode dispatch
    * - Mode handlers
      - ``backend/scripts/perf/``
      - One file per mode
    * - Shared helpers
      - ``backend/scripts/perf/utils/``
      - Metric sampling, reporting, trace statistics
    * - Dashboard
      - ``frontend/src/components/dashboard/socketprofiler/``
      - Recording and replay interface

Recording uses the Socket.IO *onAny* and *onAnyOutgoing* hooks, which is why capture is server-wide
rather than per-connection.

Limitations
-----------

**Hashes are regenerated on insert.** ``MetaModel.add`` assigns a fresh UUID hash to every inserted
row, so a trace referencing a hash captured during recording will not locate the same row on replay.
The replayer remaps hashes observed during a run, but a story that writes a recorded hash back — a
rename, for example — can still overwrite a valid pointer with a stale value.

**Numeric ids are not remapped.** Unlike hashes, ids contained in a payload are replayed as captured.
A story referencing a document by id only succeeds if that id exists at that point in the run.

**Recording is server-wide.** One recording is active at a time across the whole server. If any
participating socket disconnects, the recording stops and is flagged as disconnected.

**Recording ownership is not tracked.** The recording table stores the recorded user, not the
administrator who started the capture.

**Some events are never acknowledged.** A frontend event with no corresponding backend handler
produces no acknowledgement and is reported in a separate category rather than as a failure.

**Stories carrying dates have a limited lifetime.** A story that sets a deadline embeds that date, and
may begin failing once it passes for reasons unrelated to the platform.
