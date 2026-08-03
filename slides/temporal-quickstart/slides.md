---
theme: seriph
layout: default
title: "Temporal: A Durable Execution Framework"
info: |
  ## Temporal Quickstart
  A practical introduction to durable execution with Temporal and Python.
drawings:
  persist: false
transition: none
mdc: true
---

# The Task: Migrate a Table Between Databases

Copy `audio_downloads` from one Postgres to another. The obvious script (18 LoC):

<div class="text-xs">

```python
import asyncio, asyncpg, os

async def migrate(src: asyncpg.Pool, dst: asyncpg.Pool):
    cursor = 0
    while True:
        rows = await src.fetch(
            f"SELECT * FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
            cursor, 100,
        )
        if not rows:
            break
        cursor = rows[-1]["id"]
        async with dst.acquire() as conn:
            await conn.copy_records_to_table("audio_downloads", records=rows)

async def main():
    src = await asyncpg.create_pool(os.environ["SRC_DSN"])
    dst = await asyncpg.create_pool(os.environ["DST_DSN"])
    await migrate(src, dst)
```

</div>

If we could get this script to run uninterrupted from beginning to end, we'd be done - agreed?

---

# Imagine If This Script Has To Run For 72 Hours

<div class="grid grid-cols-2 gap-8 mt-4">
<div class="border-l-4 border-red-500 pl-4">

### Problems

- **Resumability** — Rerunning starts at the beginning
- **Observability** — Progress reporting, error reporting
- **Resilience** - Transient network hiccup, PG bounced, laptop slept -> We lost 37 hours of progress (+ manual toil to
  clean up the halfway done script)
- **Concurrency** - This is a serially executing loop. Network latency dramatically affects runtime. (Real world:
  Dave found it took 24 hours to run his naive script locally, but 5 from a VM)

</div>
<div class="border-l-4 border-yellow-500 pl-4">

### The Usual Fixes

- Resumability: Mark things in the DB so you know when you handled them (`utterance_group_migration_progress`)
- Observability: Roll your own logging, tdqm
- Resilience: Roll your own error handling
- Concurrency: Roll your own event loop

**Your 18-line script became [300+ lines of
infrastructure](https://github.com/Freespoke/freespoke/blob/d598ac8d48d215779be0f99887ec185baa2964ec/cmd/podcast_migration/migrate.sh#L4).**
It also took you 2 full working days to get it right, and even longer calendar time.

</div>
</div>

---

# Step 1: Starting Point

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python
async def migrate(src: asyncpg.Pool, dst: asyncpg.Pool):
    cursor = 0
    while True:
        rows = await src.fetch(
            "SELECT * FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
            cursor, 100,
        )
        if not rows:
            break
        cursor = rows[-1]["id"]
        async with dst.acquire() as conn:
            await conn.copy_records_to_table("audio_downloads", records=rows)
```

</div>
<div class="col-span-2 text-sm p-2 bg-gray-500/10 border-l-3 border-gray-400">

Our naive `migrate` function — a plain async function with inline DB calls.

No durability, no observability, no resilience, no concurrency.

We're going to turn this into a Temporal **Workflow** one step at a time. Our finished product is going to be 101 lines
of code, and it's going to do all of the things better than a hand-rolled 350 line script.

</div>
</div>

---

# Step 2: Wrap in a Workflow Class

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {1-5}
from temporalio import workflow

@workflow.defn
class MigrateTable:
    @workflow.run
    async def migrate(self, src: asyncpg.Pool, dst: asyncpg.Pool):
        cursor = 0
        while True:
            rows = await src.fetch(
                "SELECT * FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
                cursor, 100,
            )
            if not rows:
                break
            cursor = rows[-1]["id"]
            async with dst.acquire() as conn:
                await conn.copy_records_to_table("audio_downloads", records=rows)
```

</div>
<div class="col-span-2 text-sm p-2 bg-blue-500/10 border-l-3 border-blue-400">

**What changed:**

- `@workflow.defn` registers the class as a Temporal workflow
- `@workflow.run` marks the entry point — exactly one per workflow
- The function and its body are **unchanged**

Temporal now tracks this function's execution. If the worker crashes, Temporal replays the event history to reconstruct state.

</div>
</div>

---

# Step 3: Entrypoint function signature

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {6}
from temporalio import workflow

@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self) -> None:
        cursor = 0
        while True:
            rows = await src.fetch(
                "SELECT * FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
                cursor, 100,
            )
            if not rows:
                break
            cursor = rows[-1]["id"]
            async with dst.acquire() as conn:
                await conn.copy_records_to_table("audio_downloads", records=rows)
```

</div>
<div class="col-span-2 text-sm p-2 bg-yellow-500/10 border-l-3 border-yellow-400">

**What changed:**

`migrate` → `run`. The `@workflow.run` method, often referred to as the entrypoint, is always named `run` by convention.

The signature changes to `(self) -> None` — DB pools are no longer passed as arguments, because those aren't
serializable. We'll see where they go later on.

</div>
</div>

---

# Step 4: Workflow Code Must Be Deterministic

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {9-12,16-17}
from temporalio import workflow

@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self) -> None:
        cursor = 0
        while True:
            rows = await src.fetch(
                "SELECT * FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
                cursor, 100,
            )
            if not rows:
                break
            cursor = rows[-1]["id"]
            async with dst.acquire() as conn:
                await conn.copy_records_to_table("audio_downloads", records=rows)
```

</div>
<div class="col-span-2 text-sm p-2 bg-red-500/10 border-l-3 border-red-400">

**Problem:** This code does **database I/O** directly inside `run()`.

Temporal replays workflow code from event history to reconstruct state. If `run()` contains non-deterministic calls (DB queries, HTTP, file I/O), replay produces different results → **broken recovery**.

**The fundamental rule:** Workflow `run()` must be **deterministic**. All I/O must be extracted into **Activities**.

</div>
</div>

---

# Step 5: Extract `next_batch` Activity

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {1-2,4-9,17-20}
from temporalio import activity, workflow
from datetime import timedelta

@activity.defn
async def next_batch(cursor: int) -> list[int]:
    rows = await src.fetch(
        "SELECT id FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
        cursor, 100,
    )
    return [r["id"] for r in rows]

@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self) -> None:
        cursor = 0
        while True:
            ids = await workflow.execute_activity(
                "next_batch", cursor,
                start_to_close_timeout=timedelta(minutes=5),
            )
            if not ids:
                break
            cursor = ids[-1]
            async with dst.acquire() as conn:
                await conn.copy_records_to_table("audio_downloads", records=rows)
```

</div>
<div class="col-span-2 text-sm p-2 bg-orange-500/10 border-l-3 border-orange-400">

**What changed:**

The `src.fetch()` call is I/O. Workflow code must be **deterministic** — any I/O (database, network, file system) must happen in an **Activity**.

`next_batch` returns only IDs (`list[int]`) — keeping the serialized payload small. The actual row data stays in the database until `copy_batch` needs it.

`workflow.execute_activity()` dispatches the work and records the result in event history. On replay, the result is
restored without re-executing.

</div>
</div>

---

# Step 6: Extract `copy_batch` Activity

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {5-10,20-23}
from temporalio import activity, workflow
from datetime import timedelta

@activity.defn
async def copy_batch(ids: list[int]) -> None:
    rows = await src.fetch(
        "SELECT * FROM audio_downloads WHERE id = ANY($1::int[])", ids
    )
    async with dst.acquire() as conn:
        await conn.copy_records_to_table("audio_downloads", records=rows)

@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self) -> None:
        cursor = 0
        while True:
            ids = await workflow.execute_activity(
                "next_batch", cursor,
                start_to_close_timeout=timedelta(minutes=5),
            )
            if not ids:
                break
            cursor = ids[-1]
            await workflow.execute_activity(
                "copy_batch", ids,
                start_to_close_timeout=timedelta(minutes=5),
            )
```

</div>
<div class="col-span-2 text-sm p-2 bg-green-500/10 border-l-3 border-green-400">

**What changed:**

The `copy_records_to_table` call is also I/O — moved to `copy_batch` activity. It receives only IDs, re-fetches the full rows from `src`, then copies them to `dst`.

Now **all side effects** live in activities. The workflow is pure orchestration.

If the worker dies mid-migration, Temporal resumes from the last completed activity — not from the beginning.

</div>
</div>

---
clicks: 4
---

# Workflow: Under The Hood

Every `workflow.*` call records an **event** to durable storage. On crash, Temporal replays the event history to reconstruct state.

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {all|3-4|5-6|7-10|14-16|all}
@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self) -> None:
        cursor = 0
        while True:
            ids = await workflow.execute_activity(
                "next_batch", cursor,
                start_to_close_timeout=timedelta(minutes=5),
            )
            if not ids:
                break
            cursor = ids[-1]
            await workflow.execute_activity(
                "copy_batch", ids,
                start_to_close_timeout=timedelta(minutes=5),
            )
```

</div>
<div class="col-span-2 text-sm relative">

<div v-click="[1,2]" class="absolute inset-0 p-2 bg-blue-500/10 border-l-3 border-blue-400">
When you start a workflow execution, Temporal calls `run()` on a worker that has `MigrateTable` registered.

</div>

<div v-click="[2,3]" class="absolute inset-0 p-2 bg-gray-500/10 border-l-3 border-gray-400">

**No events created**

`cursor = 0` and the `while True` loop are plain Python — deterministic code that re-executes identically on replay.

</div>
<div v-click="[3,4]" class="absolute inset-0 p-2 bg-yellow-500/10 border-l-3 border-yellow-400">
ActivityTaskScheduled → ActivityTaskCompleted

`next_batch` dispatched, executed, result recorded. On replay, the saved result is returned without re-running the
activity.

**NOTE**: Both the inputs and outputs of an activity *must be serializable*. This is why `next_batch` returns `list[int]` instead of `asyncpg.Record` objects — `Record` is not JSON-serializable.

**NOTE**: There is a hard cap of 2MB for a single event, but you also need to consider the total size of all events in a workflow's event log.
</div>

<div v-click="[4,5]" class="absolute inset-0 p-2 bg-green-500/10 border-l-3 border-green-400">

ActivityTaskScheduled → ActivityTaskCompleted

`copy_batch` dispatched and recorded the same way. If the worker crashes after `next_batch` but before `copy_batch`, Temporal replays up to this point and resumes.

</div>

</div>
</div>

---

# Workflow: Must Be Deterministic

Workflow code is **replayed** from event history. Non-deterministic calls produce different results on replay, breaking recovery.

<div class="grid grid-cols-2 gap-8 mt-4">
<div class="border-l-4 border-green-500 pl-4">

### ✅ DO

```python
# Use Temporal APIs for I/O
result = await workflow.execute_activity(
    fetch_data,
    start_to_close_timeout=timedelta(minutes=5),
)

# Use workflow.now() for current time
now = workflow.now()

# Use workflow.random() for randomness
val = workflow.random().randint(1, 100)
```

</div>
<div class="border-l-4 border-red-500 pl-4">

### ❌ DON'T

```python
# Direct HTTP calls — not recorded
resp = requests.get("https://api.example.com")

# datetime.now() — different on replay
now = datetime.now()

# random — different on replay
val = random.randint(1, 100)

# File I/O — side effects not tracked
data = open("input.csv").read()
```

</div>
</div>

---

# Activity: Where Real Work Happens

An **Activity** is a normal function decorated with `@activity.defn`. Activities run outside the replay sandbox — they *can* do I/O, call APIs, and access databases.

```python
from temporalio import activity

@activity.defn
async def copy_to_db(batch: list[Record]) -> int:
    async with dest_pool.connection() as conn:
        for record in batch:
            await conn.execute(INSERT_SQL, record.values())
    return len(batch)
```

- Activities must be **atomic** — they completely fail or completely succeed
- All input arguments and return values of activities are serialized into a Temporal-managed event log
- On failure, Temporal retries the entire activity from scratch (configurable `RetryPolicy`)
- Timeouts (`start_to_close`, `schedule_to_close`, `heartbeat`) bound execution time
- Activities are the **only** place where side effects belong

---

# Deploying Workers: Task Queues

A **task queue** is a named channel between **clients** and **workers**. It is created implicitly — just pick a name.

```python
from temporalio.client import Client

async def main():
    client = await Client.connect("localhost:7233")

    await client.start_workflow(
        MigrateTable.run,
        id="migrate-audio-downloads",
        task_queue="migration-workers",
    )
```

- `client.start_workflow()` enqueues work — it does **not** execute it
- A worker polling `"migration-workers"` must be running to pick it up
- The task queue string ties the workflow to the workers that can execute it

---
clicks: 6
---

# Deploying Workers: The Main Function

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {all|5,15|6-9|10|11|12|13}
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker

async def main():
    client = await Client.connect("localhost:7233")

    worker = Worker(
        client,
        task_queue="migration-workers",
        workflows=[MigrateTable],
        activities=[next_batch, copy_batch],
        max_concurrent_activities=10,
    )
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

</div>
<div class="col-span-2 text-sm relative">

<div v-click="[1,2]" class="absolute inset-0 p-2 bg-blue-500/10 border-l-3 border-blue-400">

This `main()` function is **user-written code**. A worker is just a Python process you deploy like any other service.

</div>

<div v-click="[2,3]" class="absolute inset-0 p-2 bg-gray-500/10 border-l-3 border-gray-400">

It connects to the Temporal server and registers a **Worker** — a long-running process that polls for tasks.

</div>

<div v-click="[3,4]" class="absolute inset-0 p-2 bg-yellow-500/10 border-l-3 border-yellow-400">

The worker pulls tasks from the `"migration-workers"` task queue.

</div>

<div v-click="[4,5]" class="absolute inset-0 p-2 bg-orange-500/10 border-l-3 border-orange-400">

This worker is eligible to execute the `MigrateTable` workflow.

</div>

<div v-click="[5,6]" class="absolute inset-0 p-2 bg-green-500/10 border-l-3 border-green-400">

This worker is also eligible to execute `next_batch` and `copy_batch` activities.

</div>

<div v-click="6" class="absolute inset-0 p-2 bg-purple-500/10 border-l-3 border-purple-400">

`max_concurrent_activities=10` — Temporal manages task concurrency for you. Just set the limit

</div>

</div>
</div>

---

# Worker-Scoped State: The Problem

Activities need DB pools — but you can't pass a connection pool through Temporal. Arguments must be serializable.

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python
@activity.defn
async def next_batch(cursor: int) -> list[int]:
    rows = await src.fetch(  # ← where does src come from?
        "SELECT id FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
        cursor, 100,
    )
    return [r["id"] for r in rows]
```

</div>
<div class="col-span-2 text-sm p-2 bg-red-500/10 border-l-3 border-red-400">

`src` is an `asyncpg.Pool`. It can't be serialized into Temporal's event history.

The activity needs access to it, but **Temporal can only pass JSON-serializable arguments**.

How do we give activities access to resources like DB pools?

</div>
</div>

---

# Worker-Scoped State: The Solution

Use **factory functions** that close over worker-scoped state. The factory returns the actual activity function.

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {all}
def make_next_batch(src: asyncpg.Pool):
    @activity.defn
    async def next_batch(cursor: int) -> list[int]:
        rows = await src.fetch(
            "SELECT id FROM audio_downloads WHERE id > $1 ORDER BY id LIMIT $2",
            cursor, 100,
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
            await conn.copy_records_to_table("audio_downloads", records=rows)
    return copy_batch
```

</div>
<div class="col-span-2 text-sm p-2 bg-green-500/10 border-l-3 border-green-400">

`make_next_batch(src)` returns a `next_batch` function that **closes over** the `src` pool.

The pool lives in worker memory — it's never serialized. Temporal only sees the activity's serializable arguments (`cursor`, `ids`).

This is the standard pattern for giving activities access to DB pools, HTTP clients, or any non-serializable resource.

</div>
</div>

---

# Worker-Scoped State: Updated `main()`

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {6-8,18}
import asyncio, asyncpg, os
from temporalio.client import Client
from temporalio.worker import Worker

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
```

</div>
<div class="col-span-2 text-sm p-2 bg-blue-500/10 border-l-3 border-blue-400">

**What changed:**

- Create `src` and `dst` connection pools with `async with` — they're automatically closed on shutdown
- Pass them into factory functions: `make_next_batch(src)`, `make_copy_batch(src, dst)`
- The returned activity functions close over the pool objects (not shown)
- Temporal registers the activity functions as usual

The pools are shared across all activity executions on this worker — just like our original naive script, but now with durability.

</div>
</div>

---

# Continue-As-New: Why Our Workflow Needs It

Every activity result is appended to the workflow's **event history**. Our `MigrateTable` loop runs thousands of
iterations — the history grows without bound. Even though we only serialize IDs (not full rows), thousands of batches
still accumulate significant history.

<div class="grid grid-cols-5 gap-6">
<div class="col-span-3 text-xs">

```python {6-7,16}
@workflow.defn
class MigrateTable:
    @workflow.run
    async def run(self, cursor: int = 0) -> None:
        while True:
            if workflow.info().is_continue_as_new_suggested():
                workflow.continue_as_new(cursor)
            ids = await workflow.execute_activity(
                "next_batch", cursor,
                start_to_close_timeout=timedelta(minutes=5),
            )
            if not ids:
                break
            cursor = ids[-1]
            await workflow.execute_activity(
                "copy_batch", ids,
                start_to_close_timeout=timedelta(minutes=5),
            )
```

</div>
<div class="col-span-2 text-sm p-2 bg-violet-500/10 border-l-3 border-violet-400">

**What changed:**

- `run()` now accepts `cursor` as an argument (default `0` for first run)
- `workflow.continue_as_new(cursor)` terminates the current execution and starts a new one with the current cursor value
- The new execution has empty event history but picks up exactly where we left off

</div>
</div>

---

# Bonus: Upgrade To A Sync Job

Right now, when our workflow runs out of work, it breaks out of the main loop, permanently terminating. But what if we want to keep `dst` in sync with `src` for a few weeks while both databases are live?

A two-line change turns a one-shot migration into a long-running sync job:

```diff
@@ MigrateTable.run @@
             if not ids:
-                break
+                await workflow.sleep(timedelta(minutes=10))
+                continue
```

`workflow.sleep()` is a **durable timer** — if the worker restarts during the 10-minute wait, Temporal resumes the timer
from where it left off. No cron jobs, no external scheduler, no polling loop you have to babysit. Just start this worker
on one of our VMs and walk away.

The workflow keeps checking for new rows every 10 minutes. When the migration window is over, cancel the workflow from the Temporal UI or CLI.

---

# Concepts Not Covered

- **Child Workflows** — a workflow can start other workflows, enabling hierarchical decomposition
- **Signals** — send data into a running workflow from outside (e.g., cancel, pause, update config)
- **Polyglot Workflows** — a workflow can invoke activities written in a different implementation language
- **Distributed Execution** - Activities don't have to run on the same machine as the invoking workflow
- **Retry Policies** — configurable per-activity retry with backoff, max attempts, and non-retryable error types
- **Temporal UI** - sweet website that gives visibility in execution history of a workflow

---
class: text-left
---

# Table of Contents

<Toc minDepth="1" maxDepth="1" />
