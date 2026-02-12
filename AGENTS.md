Ananke is an AI Agent memory layer using epics and tickets to handle task management


* do not ever worry about backwards compatbility. Note it, but do not ever design or write for it.
* command argument validation should occur as close to the parser as possible
* use bun and not node standard library
* tests should all be scenario based tests interacting purely with the ananke CLI.
* tests should not ever assert internals of ananke (file structure, unit tests, etc)
* after making changes, both typechecks (bun run typecheck) and tests (bun run test) should be passing
* testing ananke locally should never use the default root. Always use a tmp folder and do not be destructive towards our real files
