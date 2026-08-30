Using Triggers
==============

Triggers are admin-only rules that run an action when a CARE event occurs. Open
**Triggers > Triggers** to create or manage them.

Creating a Trigger
------------------

1. Enter a name and optionally scope the trigger to a project.
2. Select the event. The current submission event runs when a file is uploaded for the
   selected assignment.
3. Select an action: send an email or run AI preprocessing.
4. Configure retry count, parallel limit, and timeout, review the rule, and save it.

Triggers can be enabled, disabled, edited, or deleted from the dashboard.

Trigger Logs
------------

Open **Triggers > Trigger Logs** to inspect execution status, attempts, and errors.

- Cancel pending or running jobs.
- Retry failed or cancelled jobs.
- Run completed jobs again.

Non-admin users cannot access triggers or trigger logs.
