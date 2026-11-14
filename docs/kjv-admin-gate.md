# King James access controls

This page describes how an administrator changes the gate. It is not a legal determination. Changing a variable does not grant rights in the Authorized Version.

## What is in force

The running site reads four server environment variables. They are not in git, and a public request cannot set them.

| Variable | Accepted values | Effect |
| --- | --- | --- |
| `KJV_GLOBAL_ENABLED` | Unset, empty, or exactly `false` is off. Exactly `true` is on. Any other value, including `TRUE`, ` true `, `1`, or `yes`, is a broken setting and the gate stays off | Must be exactly `true` before any King James text is sent |
| `KJV_ALLOWED_COUNTRIES` | Unset or empty means nobody. Otherwise a comma-separated list of ISO 3166-1 alpha-2 codes. Spaces around commas are allowed. Letters may be upper or lower case and are read as upper case. `UK`, `ENG`, `SCT`, `WLS`, and `NIR` are read as `GB`. A token that is not two letters rejects the whole list | A country that is not on a valid list is denied. A broken list denies everyone |
| `KJV_RESTRICTED_COUNTRIES` | Same list format. Unset or empty adds nothing. `GB`, `GG`, `JE`, and `IM` are always restricted even if this variable omits them | Extra codes can be added. A broken list denies everyone |
| `KJV_ENABLE_RESTRICTED` | Same exact `true` / `false` / unset rule as the global switch | After written Cambridge permission, exactly `true` lets a restricted code through only when the global switch is exactly `true` and that code is also on a valid allowlist |

A broken value is not shown to visitors. The server logs `KJV config invalid:` and the variable name only, and the decision reason is `config_invalid`. The public body stays “KJV is not available in your region.”

`UK`, `ENG`, `SCT`, `WLS`, and `NIR` are read as `GB`. Vercel reports England, Wales, Scotland, and Northern Ireland as `GB`.

There is no admin screen in the app and no request that returns this configuration. Team members change the variables in the Vercel project settings for the environment they mean to change. Preview and production are separate. This repository does not set them.

Vercel records who changed an environment variable, the time, and the project. This app does not copy that log. A change made outside Vercel would not appear there.

## Future table

`supabase/migrations/20261114103000_kjv_access_audit.sql` is still not applied to project `ixxeidpdgktzvcbucosq` and is not wired to the API. It was edited in place because it had never been applied. Row security is enabled and forced on both tables. `anon` and `authenticated` have no privileges. `service_role` can read and change the single config row. A before-insert/update trigger, security definer with an empty search path, writes the audit row (previous JSON, new JSON, `changed_by`, reason, `auth.uid()`, session user, current user, and the time). A missing name or reason is rejected. `service_role` cannot insert, update, delete, or truncate the audit table; triggers reject those mutations. There is no sequence. The table owner and superusers, including `postgres` and `supabase_admin`, can still disable triggers or delete rows. The Supabase SQL editor runs as a privileged role. This is not absolute immutability. Do not apply the file as part of turning the gate on.
