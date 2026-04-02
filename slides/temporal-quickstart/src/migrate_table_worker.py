import asyncio
import os
from datetime import timedelta

import asyncpg
from temporalio import activity, workflow
from temporalio.client import Client
from temporalio.worker import Worker

BATCH_SIZE = 100


def make_next_batch(src: asyncpg.Pool):
    @activity.defn
    async def next_batch(cursor: int) -> list[int]:
        rows = await src.fetch(
            "SELECT id FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
            cursor,
            BATCH_SIZE,
        )
        return [r["id"] for r in rows]

    return next_batch


def make_copy_batch(src: asyncpg.Pool, dst: asyncpg.Pool):
    @activity.defn
    async def copy_batch(ids: list[int]) -> None:
        rows = await src.fetch(
            "SELECT * FROM audio_downloads WHERE id = ANY($1::int[])", ids
        )
        async with dst.acquire() as conn:
            await conn.copy_records_to_table(
                "audio_downloads", records=rows, columns=[r.keys() for r in rows][0]
            )

    return copy_batch


@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self, cursor: int = 0) -> None:
        while True:
            if workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(cursor)
            ids = await workflow.execute_activity(
                "next_batch",
                cursor,
                start_to_close_timeout=timedelta(minutes=5),
            )
            if not ids:
                await workflow.sleep(timedelta(minutes=10))
                continue
            cursor = ids[-1]
            await workflow.execute_activity(
                "copy_batch",
                ids,
                start_to_close_timeout=timedelta(minutes=5),
            )


async def main():
    async with (
        asyncpg.create_pool(os.environ["SRC_DSN"], min_size=2, max_size=10) as src,
        asyncpg.create_pool(os.environ["DST_DSN"], min_size=2, max_size=10) as dst,
    ):
        client = await Client.connect("localhost:7233")

        worker = Worker(
            client,
            task_queue="migration-workers",
            workflows=[MigrateTable],
            activities=[make_next_batch(src), make_copy_batch(src, dst)],
            max_concurrent_activities=10,
        )
        await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
