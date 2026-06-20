const jwt = require('jsonwebtoken');
const User = require('../features/auth/userModel');

exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) throw new Error('You are not logged in!');

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super-ultra-secret-key');
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) throw new Error('User no longer exists');

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
