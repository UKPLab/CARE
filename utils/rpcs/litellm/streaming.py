"""Collect LiteLLM streams while forwarding temporary answer text."""

__author__ = "Mohammed Rawhani"

import asyncio
import litellm
from litellm import Router


class StreamingRouter(Router):
    """Keep Router fallbacks until the first visible answer text is sent."""

    text_started = False

    async def async_function_with_fallbacks_common_utils(self, e, *args, **kwargs):
        """LiteLLM 1.82.6 otherwise attempts continuation after stream failures."""
        if self.text_started:
            raise e
        return await super().async_function_with_fallbacks_common_utils(e, *args, **kwargs)


async def stream_completion(router, model, messages, completion_params, emit_delta):
    """Forward only answer text and return the usual assembled completion."""
    response = await router.acompletion(
        model=model,
        messages=messages,
        **{**completion_params, "stream": True, "stream_options": {"include_usage": True}},
    )
    text_buffer = []

    async def collect_chunks():
        """Keep the full response while buffering text after the first piece."""
        chunks = []
        async for chunk in response:
            choices = [choice for choice in chunk.choices or [] if choice.index == 0]
            # CARE displays one answer; the pinned builder otherwise joins choice indices.
            if choices or getattr(chunk, "usage", None) is not None:
                chunks.append(chunk.model_copy(update={"choices": choices}))
            for choice in choices:
                text = getattr(choice.delta, "content", None)
                if isinstance(text, str) and text:
                    if not router.text_started:
                        router.text_started = True
                        emit_delta(text)
                    else:
                        text_buffer.append(text)
        result = litellm.stream_chunk_builder(chunks, messages=messages)
        if result is None:
            raise ValueError("Provider returned an empty stream")
        if not any(getattr(chunk, "usage", None) is not None for chunk in chunks):
            result.usage = None
        return result

    collector = asyncio.create_task(collect_chunks())
    try:
        while True:
            # Waiting must not cancel the reader when the grouping interval expires.
            await asyncio.wait({collector}, timeout=0.05)
            if collector.done():
                result = collector.result()  # Raise failures before forwarding buffered text.
            if text_buffer:
                emit_delta("".join(text_buffer))
                text_buffer.clear()
            if collector.done():
                return result
    finally:
        collector.cancel()
        await asyncio.gather(collector, return_exceptions=True)
        # Not every provider stream wrapper exposes aclose().
        close = getattr(response, "aclose", None)
        if close:
            await close()
