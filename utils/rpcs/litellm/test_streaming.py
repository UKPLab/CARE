"""Streaming lifecycle checks without a hosted model.

Author: Mohammed Rawhani
"""
import asyncio
import threading
import unittest
from unittest.mock import AsyncMock, Mock, patch

from litellm import ModelResponse, Router
from litellm.types.utils import ModelResponseStream
from litellm.exceptions import MidStreamFallbackError
from streaming import StreamingRouter, stream_completion


def chunk(content=None, **kwargs):
    """Build provider-shaped chunks for the real LiteLLM response assembler."""
    return ModelResponseStream( model="gpt-4o-mini", id="answer-1", choices=[{
        "index": 0, "delta": {"content": content, **kwargs}, "finish_reason": None,
    }])


class StreamingTests(unittest.IsolatedAsyncioTestCase):
    async def test_groups_text_during_provider_pause_and_flushes_final_text(self):
        sent = []
        grouped = asyncio.Event()

        def emit(text):
            sent.append(text)
            if text == " there 🌍":
                grouped.set()

        async def provider():
            yield chunk("Hello")
            self.assertEqual(sent, ["Hello"])
            yield chunk(" there")
            yield chunk(" 🌍")
            self.assertEqual(sent, ["Hello"])
            # Pending text must reach the client even if no next chunk arrives.
            await asyncio.wait_for(grouped.wait(), 1)
            yield chunk("!")
            yield chunk("\n")

        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        result = await stream_completion(router, "test", [], {}, emit)
        self.assertEqual(sent, ["Hello", " there 🌍", "!\n"])
        self.assertEqual(result.choices[0].message.content, "".join(sent))

    async def test_failure_and_cancellation_discard_buffered_text(self):
        for failure in (RuntimeError("Provider failed"), asyncio.CancelledError()):
            with self.subTest(failure=type(failure).__name__):
                sent = []
                closed = asyncio.Event()

                async def provider():
                    try:
                        yield chunk("Hello")
                        yield chunk(" unsent")
                        raise failure
                    finally:
                        closed.set()

                router = StreamingRouter(model_list=[])
                router.acompletion = AsyncMock(return_value=provider())
                with self.assertRaises(type(failure)):
                    await stream_completion(router, "test", [], {}, sent.append)
                await asyncio.sleep(0.1)
                self.assertEqual(sent, ["Hello"])
                self.assertTrue(closed.is_set())

    async def test_grouped_send_failure_closes_waiting_provider(self):
        closed = asyncio.Event()

        async def provider():
            try:
                yield chunk("Hello")
                yield chunk(" there")
                await asyncio.Event().wait()
            finally:
                closed.set()

        def emit(text):
            if text != "Hello":
                raise RuntimeError("Socket send failed")

        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        with self.assertRaisesRegex(RuntimeError, "Socket send failed"):
            await asyncio.wait_for(stream_completion(router, "test", [], {}, emit), 1)
        self.assertTrue(closed.is_set())

    async def test_missing_provider_usage_stays_unavailable(self):
        async def provider():
            yield chunk("Hello")
        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        response = await stream_completion(router, "gpt-4o-mini", [{"role": "user", "content": "Hi"}], {}, lambda text: None)
        self.assertIsNone(response.usage)

    async def test_text_arrives_before_completion_and_usage_is_preserved(self):
        first = asyncio.Event()
        resume = asyncio.Event()
        closed = asyncio.Event()

        async def provider():
            try:
                yield chunk(role="assistant")
                yield ModelResponseStream(model="gpt-4o-mini", id="answer-1", choices=[{
                    "index": 1, "delta": {"content": "Other choice"}, "finish_reason": None,
                }])
                yield chunk(reasoning_content="Private reasoning")
                yield chunk("Hello")
                first.set()
                await resume.wait()
                yield chunk(" world 🌍\n")
                yield ModelResponseStream( model="gpt-4o-mini", id="answer-1", choices=[{
                    "index": 0, "delta": {}, "finish_reason": "stop",
                }])
                yield ModelResponseStream( model="gpt-4o-mini", id="answer-1", choices=[],
                                    usage={"prompt_tokens": 4, "completion_tokens": 2, "total_tokens": 6})
            finally:
                closed.set()

        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        texts = []
        task = asyncio.create_task(stream_completion(router, "gpt-4o-mini", [], {}, texts.append))
        await asyncio.wait_for(first.wait(), 2)
        self.assertEqual(texts, ["Hello"])
        self.assertFalse(task.done())
        resume.set()
        response = await task
        self.assertEqual(response.choices[0].message.content, "Hello world 🌍\n")
        self.assertEqual(response.usage.total_tokens, 6)
        self.assertTrue(closed.is_set())

    async def test_cancel_closes_provider(self):
        started = asyncio.Event()
        closed = asyncio.Event()
        sent = []

        async def provider():
            try:
                yield chunk("Hello")
                yield chunk(" unsent")
                started.set()
                await asyncio.Event().wait()
            finally:
                closed.set()

        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        task = asyncio.create_task(stream_completion(router, "test", [], {}, sent.append))
        await asyncio.wait_for(started.wait(), 2)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(closed.is_set())
        self.assertEqual(sent, ["Hello"])

    async def test_router_fallback_is_only_allowed_before_visible_text(self):
        router = StreamingRouter(model_list=[])
        error = RuntimeError("Provider disconnected")
        with patch.object(Router, "async_function_with_fallbacks_common_utils", new_callable=AsyncMock) as fallback:
            fallback.return_value = "fallback answer"
            self.assertEqual(await router.async_function_with_fallbacks_common_utils(e=error), "fallback answer")
            router.text_started = True
            with self.assertRaisesRegex(RuntimeError, "Provider disconnected"):
                await router.async_function_with_fallbacks_common_utils(e=error)
            self.assertEqual(fallback.await_count, 1)

    async def test_pinned_router_wrapper_closes_and_does_not_continue_visible_answer(self):
        class Provider:
            model = "gpt-4o-mini"
            custom_llm_provider = "openai"
            logging_obj = Mock(model_call_details={})
            chunks = [chunk("Partial")]
            aclose = AsyncMock()

            async def __aiter__(self):
                yield self.chunks[0]
                raise MidStreamFallbackError(message="Lost connection", model=self.model, llm_provider="openai",
                                             original_exception=RuntimeError("Lost connection"), generated_content="Partial")

        router = StreamingRouter(model_list=[])
        provider = Provider()
        wrapped = await router._acompletion_streaming_iterator(provider, [], {"model": provider.model})
        router.acompletion = AsyncMock(return_value=wrapped)
        texts = []
        with patch.object(Router, "async_function_with_fallbacks_common_utils", new_callable=AsyncMock) as fallback:
            with self.assertRaises(MidStreamFallbackError):
                await stream_completion(router, provider.model, [], {}, texts.append)
            fallback.assert_not_called()
        self.assertEqual(texts, ["Partial"])
        provider.aclose.assert_awaited_once()

    async def test_pinned_router_allows_fallback_before_visible_text(self):
        class Provider:
            model = "gpt-4o-mini"
            custom_llm_provider = "openai"
            logging_obj = Mock(model_call_details={})
            chunks = [chunk(role="assistant")]
            aclose = AsyncMock()

            async def __aiter__(self):
                yield self.chunks[0]
                raise MidStreamFallbackError(message="Rate limited", model=self.model, llm_provider="openai",
                                             original_exception=RuntimeError("Rate limited"), generated_content="",
                                             is_pre_first_chunk=True)

        async def fallback_response():
            yield chunk("Fallback answer")

        router = StreamingRouter(model_list=[])
        provider = Provider()
        wrapped = await router._acompletion_streaming_iterator(provider, [], {"model": provider.model})
        router.acompletion = AsyncMock(return_value=wrapped)
        texts = []
        with patch.object(Router, "async_function_with_fallbacks_common_utils", new_callable=AsyncMock) as fallback:
            fallback.return_value = fallback_response()
            result = await stream_completion(router, provider.model, [], {}, texts.append)
            fallback.assert_awaited_once()
        self.assertEqual(texts, ["Fallback answer"])
        self.assertEqual(result.choices[0].message.content, "Fallback answer")
        provider.aclose.assert_awaited_once()


class BridgeTests(unittest.TestCase):
    def test_regular_completions_cannot_be_streamed_by_model_parameters(self):
        import main

        router = Mock(acompletion=AsyncMock(return_value=ModelResponse(
            model="test", choices=[{"message": {"role": "assistant", "content": "Complete answer"}}],
        )))
        with patch.object(main, "Router", return_value=router), \
                patch.object(main.socketio, "WSGIApp", side_effect=lambda sio: sio):
            sio = main.create_app()
            sio.emit = Mock()
            result = sio.handlers["/"]["chatCompletion"]("owner", {
                "requestId": "regular", "params": {"model": "test", "messages": [{"role": "user", "content": "Hi"}],
                                                       "stream": True, "stream_options": {"include_usage": True}},
            })
            self.assertTrue(result["success"])
            self.assertEqual(result["data"]["choices"][0]["message"]["content"], "Complete answer")
            self.assertFalse(router.acompletion.call_args.kwargs["stream"])
            self.assertNotIn("stream_options", router.acompletion.call_args.kwargs)
            sio.emit.assert_not_called()

    def test_bridge_streams_before_ack_rejects_duplicate_and_aborts_iteration(self):
        import main

        started = threading.Event()
        closed = threading.Event()

        async def provider():
            try:
                yield chunk("Hello")
                started.set()
                await asyncio.sleep(60)
            finally:
                closed.set()

        router = StreamingRouter(model_list=[])
        router.acompletion = AsyncMock(return_value=provider())
        with patch.object(main, "StreamingRouter", return_value=router), \
                patch.object(main.socketio, "WSGIApp", side_effect=lambda sio: sio):
            sio = main.create_app()
            sio.emit = Mock()
            handler = sio.handlers["/"]["chatCompletion"]
            abort = sio.handlers["/"]["abortChatCompletion"]
            data = {"requestId": "a", "streamId": "private", "timeoutMs": 2000,
                    "params": {"model": "test", "messages": [{"role": "user", "content": "Hi"}]}}
            results = []
            worker = threading.Thread(target=lambda: results.append(handler("owner", data)))
            worker.start()
            try:
                self.assertTrue(started.wait(3))
                self.assertEqual(results, [])
                sio.emit.assert_called_once_with("chatCompletionDelta", {"streamId": "private", "text": "Hello"}, to="owner")
                self.assertFalse(handler("owner", data)["success"])
                self.assertTrue(abort("owner", {"requestId": "a"})["data"]["aborted"])
            finally:
                abort("owner", {"requestId": "a"})
                worker.join(3)
            self.assertFalse(worker.is_alive())
            self.assertTrue(closed.is_set())
            self.assertEqual(results, [{"success": False, "message": "Request aborted"}])
            self.assertFalse(abort("owner", {"requestId": "a"})["data"]["aborted"])


if __name__ == "__main__":
    unittest.main()
