+ means done
TODO
necessary:
+ replies
+ after deleting a channel, the page should load another channel
+ need to be able to log out after login
+ forgot password functionality
+ direct message functionality
+ presence status
+ file upload

- check for inconsistencies and duplicate definitions

nice to have:
+ files deleted in bucket when deleting message <- delete files with storage api instead of edge function
- search over all channels
- integrate auth with google+github
- delete account functionality
- UI: more distinct login vs. signup in auth form
- need access control for database
- database aggregation for reaction counts on server side
- people see who liked what
+ efficiency: Don't do linear search over messages to do modifications anymore in chat-area.tsx, but find the right message in a dict or similar <- that turned out to be not necessary as react does O(n) comparison after update anyway
- efficiency: Check for the number of queries to fetch data
- efficiency: When loading page, get initial messages/channels directly?? But that's hard I guess
- "unread messages" notification in non-open channels.
- apparently, when I leave the window open for too long, the live subscription stops...?


Vector search:
- rebuild index periodically to improve HNSW quality