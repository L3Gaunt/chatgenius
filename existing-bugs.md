TODO
necessary:
+ replies
+ after deleting a channel, the page should load another channel
+ need to be able to log out after login
+ forgot password functionality
- direct message functionality
- presence status
- file upload

nice to have:
- search over all channels
- integrate auth with google+github
- delete account functionality
- UI: more distinct login vs. signup in auth form
- need access control for database
- database aggregation for reaction counts on server side
- people see who liked what
- efficiency: Don't do linear search over messages to do modifications anymore in chat-area.tsx, but find the right message in a dict or similar
- efficiency: Check for the number of queries to fetch data
- efficiency: When loading page, get initial messages/channels directly?? But that's hard I guess
- "unread messages" notification in non-open channels.