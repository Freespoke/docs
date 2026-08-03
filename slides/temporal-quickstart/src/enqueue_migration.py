import asyncio
import sys

from temporalio.client import Client

from .migrate_table_worker import MigrateTable


async def main():
    workflow_id = sys.argv[1]
    client = await Client.connect("localhost:7233")

    await client.start_workflow(
        MigrateTable.run,
        id=workflow_id,
        task_queue="migration-workers",
    )


if __name__ == "__main__":
    asyncio.run(main())
