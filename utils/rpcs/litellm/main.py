import logging
import socketio
import litellm


def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading', ping_timeout=120, ping_interval=25)

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
        model = data.get("model")
        messages = data.get("messages")

        if not model:
            return {"success": False, "message": "Missing required field: model"}
        if not messages:
            return {"success": False, "message": "Missing required field: messages"}

        logger.info(f"chatCompletion from {sid}: model={model}")

        try:
            params = {k: v for k, v in data.items()
                      if k not in ("model", "messages") and v is not None}

            response = litellm.completion(
                model=model,
                messages=messages,
                **params,
            )

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
            logger.error(f"chatCompletion error: {e}")
            return {"success": False, "message": str(e)}

    logger.info("Creating LiteLLM RPC App...")
    app = socketio.WSGIApp(sio)
    return app
