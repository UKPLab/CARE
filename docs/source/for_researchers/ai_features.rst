Using AI Features
=================

CARE provides dashboards for configuring AI access, controlling costs, and reviewing
usage. These features require the LiteLLM RPC service described in
:doc:`../getting_started/installation`.

AI Credentials
--------------

Credentials are managed in **AI > AI Models**.

- Select **Add Credential**, enter a name and provider, then supply an API key or compatible
  base URL.
- Use the optional API version only when the provider requires it.
- Disable a credential to prevent its linked models from being used.
- When editing, leave the API key empty to keep the existing key.

Only the credential owner can edit or delete it.

AI Models
---------

Models are also managed in **AI > AI Models**.

- Select **Add Model**, choose an enabled credential, and load or enter the provider's model
  identifier.
- Optional parameters such as ``temperature`` can be supplied as JSON.
- Use **Test** to verify the credential and model before saving.
- A model can be enabled, disabled, shared with users or roles, or given a total cost limit.
- Mark a self-hosted or free model as free only when its requests should bypass spending
  limits.

Only the owner can edit, share, or delete a model. Shared models are shown with their owner.

AI Hooks
--------

An AI hook combines a prompt template with one or more models.

1. Create a :ref:`prompt template <prompt-templates-user>`.
2. Open **AI > AI Hooks** and select **Add AI Hook**.
3. Select the prompt template and place models in fallback priority order.
4. Choose **Text** or **JSON** output, optionally set a total cost limit, and save.

Hook owners can reorder models, enable or disable the hook, and share it with users or roles.
A hook requires a name, prompt template, and at least one model.

AI Budget
---------

**AI > AI Budget** lists cost limits for models, hooks, studies, and study steps.

- Edit a limit to change the allowed cost.
- Set a limit to ``0`` to block usage at that level.
- Reset the spending window without changing the limit.
- Remove the cap to allow usage without that limit.

The dashboard groups limits by models, hooks, and studies and shows whether each limit is
total, per session, or per user.

AI Log
------

**AI > AI Log** provides an audit summary and request history.

- The summary shows total requests, input and output tokens, and total cost.
- Each row shows the request time, model, status, token counts, and cost.
- Search and sorting can be used to investigate failed or expensive requests.
