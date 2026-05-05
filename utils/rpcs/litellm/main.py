import asyncio
import logging
import os
import re
import threading
import socketio
import litellm
from litellm import Router


def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading', ping_timeout=120, ping_interval=25)
    active_requests = {}
    active_requests_lock = threading.Lock()
    default_router_retries = int(os.environ.get("LITELLM_ROUTER_RETRIES", "2"))

    def normalize_model_list(raw_models):
        if not isinstance(raw_models, list):
            return []
        models = []
        for item in raw_models:
            if not item:
                continue
            as_text = str(item).strip()
            if as_text:
                models.append(as_text)
        return list(dict.fromkeys(models))

    def build_router(model, completion_params):
        fallback_models = normalize_model_list(completion_params.pop("fallback_models", []))
        model_order = [model] + [m for m in fallback_models if m != model]

        router_model_list = []
        for model_name in model_order:
            litellm_params = {"model": model_name}
            for key in ("api_key", "api_base", "api_version"):
                if completion_params.get(key) is not None:
                    litellm_params[key] = completion_params[key]
            router_model_list.append({"model_name": model_name, "litellm_params": litellm_params})

        retries = completion_params.get("num_retries")
        if retries is None:
            retries = default_router_retries
        else:
            try:
                retries = int(retries)
            except Exception:
                retries = default_router_retries

        router_kwargs = {
            "model_list": router_model_list,
            "num_retries": max(0, retries),
        }
        if fallback_models:
            router_kwargs["fallbacks"] = [{model: fallback_models}]
        return Router(**router_kwargs)

    def normalize_reasoning_content(response_data):
        if not isinstance(response_data, dict):
            return None
        direct = response_data.get("reasoning_content")
        if isinstance(direct, str) and direct.strip():
            return direct.strip()

        for choice in response_data.get("choices", []) or []:
            message = choice.get("message") if isinstance(choice, dict) else None
            if isinstance(message, dict):
                for key in ("reasoning_content", "reasoning", "thinking"):
                    value = message.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
            if isinstance(choice, dict):
                for key in ("reasoning_content", "reasoning"):
                    value = choice.get(key)
                    if isinstance(value, str) and value.strip():
                        return value.strip()
        return None

    def normalize_response_cost(response_data):
        if not isinstance(response_data, dict):
            return None
        cost = response_data.get("response_cost")
        if cost is None and isinstance(response_data.get("_hidden_params"), dict):
            cost = response_data["_hidden_params"].get("response_cost")
        try:
            numeric_cost = float(cost)
            return numeric_cost
        except (TypeError, ValueError):
            return None

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
        Passthrough to litellm Router completion. Caller supplies `model` and
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

        request_state = {
            "cancelled": False,
            "done": threading.Event(),
            "response": None,
            "error": None,
            "loop": None,
            "task": None,
        }
        with active_requests_lock:
            active_requests[request_id] = request_state

        try:
            completion_params = {k: v for k, v in params.items()
                                 if k not in ("model", "messages") and v is not None}

            if "timeout" not in completion_params and timeout_ms:
                completion_params["timeout"] = int(timeout_ms) / 1000

            def run_async_completion():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    router = build_router(model, completion_params)
                    task = loop.create_task(router.acompletion(
                        model=model,
                        messages=messages,
                        **completion_params,
                    ))
                    with active_requests_lock:
                        request_state["loop"] = loop
                        request_state["task"] = task
                    request_state["response"] = loop.run_until_complete(task)
                except asyncio.CancelledError:
                    request_state["error"] = RuntimeError("Request aborted")
                except Exception as exc:
                    request_state["error"] = exc
                finally:
                    request_state["done"].set()
                    try:
                        loop.stop()
                    except Exception:
                        pass
                    loop.close()

            worker = threading.Thread(target=run_async_completion, daemon=True)
            worker.start()
            wait_timeout_ms = timeout_ms if timeout_ms else 120000
            wait_timeout_seconds = max(1, int(wait_timeout_ms) / 1000) + 5
            completed = request_state["done"].wait(wait_timeout_seconds)
            if not completed:
                with active_requests_lock:
                    request_state["cancelled"] = True
                    task = request_state.get("task")
                    loop = request_state.get("loop")
                try:
                    if task and loop and not task.done():
                        loop.call_soon_threadsafe(task.cancel)
                except Exception as exc:
                    logger.warning(f"chatCompletion timeout cancellation warning: requestId={request_id} {exc}")
                raise TimeoutError("chatCompletion timed out waiting for provider response")

            if request_state["cancelled"]:
                logger.info(f"chatCompletion aborted: requestId={request_id}")
                return {"success": False, "message": "Request aborted"}

            if request_state["error"] is not None:
                raise request_state["error"]

            response = request_state["response"]

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
            response_data["reasoning_content"] = normalize_reasoning_content(response_data)
            response_data["response_cost"] = normalize_response_cost(response_data)
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
        provider = str(data.get("provider") or "").strip().lower()
        provider = provider.replace(" inference", "").replace(" ", "_")
        api_key = data.get("apiKey")
        api_base = data.get("apiBaseUrl")
        api_version = data.get("apiVersion")

        if not api_key:
            return {"success": False, "message": "Missing required field: apiKey"}

        logger.info(f"getValidModels from {sid}: provider={provider or 'auto'}")

        try:
            kwargs = {
                "check_provider_endpoint": True,
                "custom_llm_provider": provider or None,
                "api_key": api_key,
                "api_base": api_base,
                "api_version": api_version,
            }
            kwargs = {k: v for k, v in kwargs.items() if v is not None}
            valid_models = None

            while True:
                try:
                    valid_models = litellm.get_valid_models(**kwargs)
                    break
                except TypeError as type_error:
                    # LiteLLM function signatures differ by version; gracefully
                    # drop unknown kwargs and retry.
                    match = re.search(r"unexpected keyword argument '([^']+)'", str(type_error))
                    unexpected_key = match.group(1) if match else None
                    if not unexpected_key or unexpected_key not in kwargs:
                        raise
                    kwargs.pop(unexpected_key, None)

            models = sorted({str(model) for model in (valid_models or []) if model})
            return {"success": True, "data": {"models": models}}
        except Exception as e:
            logger.error(f"getValidModels error: provider={provider} {e}")
            return {"success": False, "message": str(e)}

    @sio.on("abortChatCompletion")
    def abort_chat_completion(sid, data):
        """
        Mark an in-flight completion as cancelled and cancel the async task.
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
                task = request_state.get("task")
                loop = request_state.get("loop")
            else:
                task = None
                loop = None

        if not request_state:
            logger.info(f"abortChatCompletion ignored for inactive requestId={request_id}")
            return {"success": True, "data": {"aborted": False, "message": "Request is not active"}}

        try:
            if task and loop and not task.done():
                loop.call_soon_threadsafe(task.cancel)
        except Exception as exc:
            logger.warning(f"abortChatCompletion cancellation warning: requestId={request_id} {exc}")

        logger.info(f"abortChatCompletion marked requestId={request_id}: {reason}")
        return {"success": True, "data": {"aborted": True}}

    logger.info("Creating LiteLLM RPC App...")
    app = socketio.WSGIApp(sio)
    return app
