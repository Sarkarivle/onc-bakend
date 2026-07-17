const jwt = require('jsonwebtoken');
const User = require('../features/auth/userModel');
const JWT_SECRET = require('../config/jwt');
const { getRedis } = require('../config/redis');

// Short TTL: caps how long a role change/ban takes to take effect, in
// exchange for skipping a DB round-trip on most requests.
const CACHE_TTL_SECONDS = 300;
const cacheKey = (id) => `auth:user:${id}`;

// Only id/_id/role/phone/name are ever read off req.user anywhere in this
// codebase (grepped across src/) - controllers that need the full profile
// (education, height, category, dob, etc.) already re-fetch the user
// themselves. Caching just this slice means cache hits can't leak stale
// profile data into anything that matters.
const toCacheable = (user) => ({
    _id: user._id.toString(),
    id: user._id.toString(),
    role: user.role,
    phone: user.phone,
    name: user.name,
});

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) throw new Error('You are not logged in!');

    const decoded = jwt.verify(token, JWT_SECRET);
    const redis = getRedis();

    if (redis) {
        try {
            const cached = await redis.get(cacheKey(decoded.id));
            if (cached) {
                req.user = JSON.parse(cached);
                return next();
            }
        } catch (err) {
            // Redis hiccup - fall through to the DB lookup below.
        }
    }

    const currentUser = await User.findById(decoded.id);
    if (!currentUser) throw new Error('User no longer exists');

    if (redis) {
        redis.set(cacheKey(decoded.id), JSON.stringify(toCacheable(currentUser)), { EX: CACHE_TTL_SECONDS }).catch(() => {});
    }

    req.user = currentUser;
    next();
  } catch (err) {
    res.status(401).json({ status: 'fail', message: err.message });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Debugging: Role check
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: `Permission Denied! Your current role is '${req.user.role}', but you need to be '${roles.join(' or ')}'.`
      });
    }
    next();
  };
};
