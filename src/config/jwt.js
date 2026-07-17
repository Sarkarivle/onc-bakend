// A missing JWT_SECRET must never silently fall back to a string that's
// public in this codebase's git history - that would let anyone forge a
// valid auth token. Fail fast at boot instead.
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set. Set it in .env before starting the server.');
}

module.exports = process.env.JWT_SECRET;
