import logging
import threading
import socketio
import litellm


def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading', ping_timeout=120, ping_interval=25)
    active_requests = {}
    active_requests_lock = threading.Lock()

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
