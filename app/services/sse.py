import asyncio
from collections import defaultdict
from typing import Any, Dict, Set


class SSEBroadcaster:
    def __init__(self) -> None:
        self._channels: Dict[str, Set[asyncio.Queue]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def register(self, token: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._channels[token].add(queue)
        return queue

    async def unregister(self, token: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            if token in self._channels and queue in self._channels[token]:
                self._channels[token].remove(queue)
                if not self._channels[token]:
                    del self._channels[token]

    async def broadcast(self, token: str, payload: Dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._channels.get(token, set()))
        for queue in queues:
            await queue.put(payload)
