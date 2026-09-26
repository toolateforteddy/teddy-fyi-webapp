# teddy-fyi-webapp

How to work in this repo. `README.md` describes the apps; `DEPLOYMENT.md` covers how they ship.

## Pull requests: draft until they wait on Teddy

**Open every pull request as a draft, and take it out of draft only when the next move is
Teddy's.** A draft says "still mine"; ready for review says "yours now". Teddy reads the
second as the signal to look, so a PR should not reach it early and should not sit in draft
once nothing is left for Claude to do.

A PR is waiting on Teddy when all of these hold:

- CI has finished on the latest commit, and every check is green.
- It has no merge conflict with its base branch.
- No review thread is waiting on a reply or a push from Claude.

Mark it ready for review first, then say it is ready to merge.
