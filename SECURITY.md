# Security Policy

## Supported version

Security fixes are applied to the latest commit on the default branch. Older commits and private forks are not supported.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's **Security → Report a vulnerability** flow for this repository so credentials, proof-of-concept material, and affected data stay private.

Include the affected endpoint or file, reproduction steps, impact, and any suggested mitigation. Please avoid accessing data that is not yours and do not run destructive tests against public deployments.

## Deployment notes

- Set `APP_ENV=production` and a unique `JWT_SECRET_KEY` of at least 32 characters.
- Set `DEFAULT_ADMIN_PASSWORD` before the first start, then rotate it from the profile page.
- Put the application behind HTTPS and a reverse proxy with request/body limits and login rate limiting.
- Treat meeting audio, transcripts, LLM API keys, and DingTalk webhooks as sensitive data.
- Do not expose the SQLite database, `data/`, `.env`, or model directories through a web server.
