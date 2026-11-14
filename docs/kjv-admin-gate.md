# King James access controls

This page describes how an administrator changes the gate. It is not a legal determination. Changing a variable does not grant rights in the Authorized Version.

## What is in force

The running site reads four server environment variables. They are not in git, and a public request cannot set them.

| Variable | Default | Effect |
| --- | --- | --- |
| `KJV_GLOBAL_ENABLED` | unset, treated as off | Must be the string `true` before any King James text is sent |
| `KJV_ALLOWED_COUNTRIES` | empty | Explicit ISO codes. A country that is not listed is denied |
| `KJV_RESTRICTED_COUNTRIES` | `GB`, `GG`, `JE`, `IM` are always included | Extra codes can be added. The four built-in codes cannot be removed |
| `KJV_ENABLE_RESTRICTED` | unset, treated as off | After written Cambridge permission, `true` lets a restricted code through only when the global switch is on and that code is also on the allowlist |

`UK`, `ENG`, `SCT`, `WLS`, and `NIR` are read as `GB`. Vercel reports England, Wales, Scotland, and Northern Ireland as `GB`.

There is no admin screen in the app and no request that returns this configuration. Team members change the variables in the Vercel project settings for the environment they mean to change. Preview and production are separate. This repository does not set them.

Vercel records who changed an environment variable, the time, and the project. This app does not copy that log. A change made outside Vercel would not appear there.

## Future table

`supabase/migrations/20261114103000_kjv_access_audit.sql` is a design for an append-only log and a config row, readable and writable only by `service_role`. It is not applied to project `ixxeidpdgktzvcbucosq` and it is not wired to the API. Do not apply it as part of turning the gate on. The gate stays on the environment variables above until that table has its own reviewed change.
