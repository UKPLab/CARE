import inspect
import importlib
import logging
import json
import os
import threading
import urllib.request
import socketio
import litellm


def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading', ping_timeout=120, ping_interval=25)
    active_requests = {}
    active_requests_lock = threading.Lock()
    litellm_config_lock = threading.Lock()
    missing_config = object()

    def normalized_provider(provider):
        return str(provider or "").strip().lower().replace(" ", "_")

    def get_valid_models_fn():
        fn = getattr(litellm, "get_valid_models", None)
        if fn:
            return fn
        return getattr(importlib.import_module("litellm.utils"), "get_valid_models")

    def get_valid_models_kwargs(fn, provider, api_key, api_base, api_version):
        possible_kwargs = {
            "check_provider_endpoint": True,
            "custom_llm_provider": provider,
            "api_key": api_key,
            "api_base": api_base,
            "api_version": api_version,
        }
        signature = inspect.signature(fn)
        accepts_kwargs = any(
            param.kind == inspect.Parameter.VAR_KEYWORD
            for param in signature.parameters.values()
        )
        if accepts_kwargs:
            return {key: value for key, value in possible_kwargs.items() if value}
        return {
            key: value
            for key, value in possible_kwargs.items()
            if value and key in signature.parameters
        }

    def provider_api_key_env(provider):
        clean_provider = normalized_provider(provider).upper()
        return f"{clean_provider}_API_KEY" if clean_provider else None

    def set_litellm_credential(provider, api_key, api_base, api_version):
        config_keys = ["api_key", "api_base", "api_version"]
        if provider:
            config_keys.append(f"{provider}_key")
        env_key = provider_api_key_env(provider)
        snapshot = {
            "litellm": {
                key: getattr(litellm, key) if hasattr(litellm, key) else missing_config
                for key in config_keys
            },
            "env": {
                env_key: os.environ.get(env_key, missing_config)
            } if env_key else {},
        }
        litellm.api_key = api_key
        if provider:
            setattr(litellm, f"{provider}_key", api_key)
        if env_key:
            os.environ[env_key] = api_key
        litellm.api_base = api_base or None
        litellm.api_version = api_version or None
        return snapshot

    def restore_litellm_config(snapshot):
        for key, value in snapshot["litellm"].items():
            if value is missing_config:
                if hasattr(litellm, key):
                    delattr(litellm, key)
                continue
            setattr(litellm, key, value)
        for key, value in snapshot["env"].items():
            if value is missing_config:
                os.environ.pop(key, None)
                continue
            os.environ[key] = value

    def default_openai_compatible_base(provider):
        if provider == "groq":
            return "https://api.groq.com/openai/v1"
        return None

    def fetch_openai_compatible_models(provider, api_key, api_base):
        base_url = (api_base or default_openai_compatible_base(provider) or "").rstrip("/")
        if not base_url:
            return []
        request = urllib.request.Request(
            f"{base_url}/models",
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
        models = []
        for item in payload.get("data", []):
            model_id = item.get("id") if isinstance(item, dict) else None
            if not model_id:
                continue
            models.append(f"{provider}/{model_id}" if provider and not model_id.startswith(f"{provider}/") else model_id)
        return models

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("healthy")
    def healthy(sid, data):
        """
        Liveness probe: process is up and litellm is importable.
        No model check - credentials arrive per-request, so there's nothing
        to verify upfront. See litellm /health/liveliness for the same idea.
        """
        logger.info(f"Health check from {sid}")
        try:
            return {
                "success": True,
                "data": {
                    "status": "ok",
                    "litellm_version": getattr(litellm, "__version__", "unknown"),
                },
            }
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return {"success": False, "message": str(e)}

    @sio.on("chatCompletion")
    def chat_completion(sid, data):
        """
        Passthrough to litellm.completion(). Caller supplies `model` and
        `messages` (required); all other keys are forwarded verbatim, so the
        caller controls provider, API key, and any extra parameters.
        """
        data = data or {}
        request_id = data.get("requestId")
        timeout_ms = data.get("timeoutMs")
        params = data.get("params") or {}

        if not request_id:
            return {"success": False, "message": "Missing required field: requestId"}

        model = params.get("model")
        messages = params.get("messages")

        if not model:
            return {"success": False, "message": "Missing required field: model"}
        if not messages:
            return {"success": False, "message": "Missing required field: messages"}

        logger.info(f"chatCompletion from {sid}: model={model} requestId={request_id}")

        request_state = {"cancelled": False}
        with active_requests_lock:
            active_requests[request_id] = request_state

        try:
            completion_params = {k: v for k, v in params.items()
                                 if k not in ("model", "messages") and v is not None}

            if "timeout" not in completion_params and timeout_ms:
                completion_params["timeout"] = int(timeout_ms) / 1000

            response = litellm.completion(
                model=model,
                messages=messages,
                **completion_params,
            )

            if request_state["cancelled"]:
                logger.info(f"chatCompletion aborted after provider returned: requestId={request_id}")
                return {
                    "success": False,
                    "message": "Not implemented: provider-level abort is unavailable; request was marked aborted",
                }

            # Return the full response as-is. ModelResponse is a pydantic
            # model, so model_dump() gives the complete OpenAI-compatible
            # dict without hand-mapping (which would silently drop any new
            # fields litellm / the provider adds).
            if hasattr(response, "model_dump"):
                response_data = response.model_dump()
            elif hasattr(response, "dict"):
                response_data = response.dict()
            else:
                response_data = dict(response)

            usage = response_data.get("usage") or {}
            logger.info(
                f"chatCompletion success: model={response_data.get('model')}, "
                f"tokens={usage.get('total_tokens', 'N/A')}"
            )
            return {"success": True, "data": response_data}

        except Exception as e:
            logger.error(f"chatCompletion error: requestId={request_id} {e}")
            return {"success": False, "message": str(e)}
        finally:
            with active_requests_lock:
                active_requests.pop(request_id, None)

    @sio.on("getValidModels")
    def get_valid_models(sid, data):
        """
        Return models available for a credential. The key is scoped to LiteLLM's
        runtime config for this request instead of requiring provider env vars.
        """
        data = data or {}
        provider = normalized_provider(data.get("provider"))
        api_key = data.get("apiKey")
        api_base = data.get("apiBaseUrl")
        api_version = data.get("apiVersion")

        if not api_key:
            return {"success": False, "message": "Missing required field: apiKey"}

        logger.info(f"getValidModels from {sid}: provider={provider or 'auto'}")

        try:
            with litellm_config_lock:
                snapshot = set_litellm_credential(provider, api_key, api_base, api_version)
                try:
                    fn = get_valid_models_fn()
                    kwargs = get_valid_models_kwargs(fn, provider, api_key, api_base, api_version)
                    valid_models = fn(**kwargs)
                    if not valid_models:
                        valid_models = fetch_openai_compatible_models(provider, api_key, api_base)
                finally:
                    restore_litellm_config(snapshot)

            models = sorted({str(model) for model in (valid_models or []) if model})
            return {"success": True, "data": {"models": models}}
        except Exception as e:
            logger.error(f"getValidModels error: provider={provider} {e}")
            return {"success": False, "message": str(e)}

    @sio.on("abortChatCompletion")
    def abort_chat_completion(sid, data):
        """
        Mark an in-flight completion as cancelled.

        LiteLLM's synchronous completion API does not expose a provider-level
        abort handle, so this records cancellation for result suppression while
        the per-request LiteLLM timeout caps the provider call.
        """
        data = data or {}
        request_id = data.get("requestId")
        reason = data.get("reason") or "request aborted"

        if not request_id:
            return {"success": False, "message": "Missing required field: requestId"}

        with active_requests_lock:
            request_state = active_requests.get(request_id)
            if request_state:
                request_state["cancelled"] = True

        if not request_state:
            logger.info(f"abortChatCompletion ignored for inactive requestId={request_id}")
            return {"success": True, "data": {"aborted": False, "message": "Request is not active"}}

        logger.info(f"abortChatCompletion marked requestId={request_id}: {reason}")
        return {"success": True, "data": {"aborted": True}}

    logger.info("Creating LiteLLM RPC App...")
    app = socketio.WSGIApp(sio)
    return app
