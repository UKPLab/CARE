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

    @sio.on("call")
    def call(sid, data):
        logger.info(f"Health check call from {sid}")
        return {"success": True, "data": "LiteLLM RPC is running"}

    @sio.on("chatCompletion")
    def chat_completion(sid, data):
        """
        Pure passthrough to litellm.completion().
        Caller must provide 'model' and 'messages'. Everything else is forwarded
        as-is to litellm so the caller controls the provider, key, and parameters.
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
                **params
            )

            result = {
                "success": True,
                "data": {
                    "id": response.id,
                    "model": response.model,
                    "choices": [
                        {
                            "index": c.index,
                            "message": {
                                "role": c.message.role,
                                "content": c.message.content,
                            },
                            "finish_reason": c.finish_reason,
                        }
                        for c in response.choices
                    ],
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    } if response.usage else None,
                }
            }
            logger.info(
                f"chatCompletion success: model={response.model}, "
                f"tokens={response.usage.total_tokens if response.usage else 'N/A'}"
            )
            return result

        except Exception as e:
            logger.error(f"chatCompletion error: {e}")
            return {"success": False, "message": str(e)}

    logger.info("Creating LiteLLM RPC App...")
    app = socketio.WSGIApp(sio)
    return app
