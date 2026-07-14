const FeedPost = require('./feedModel');
const { getRedis } = require('../../config/redis');

const CACHE_KEY = 'jobo:feed:all';
const CACHE_TTL = 300; // 5 Minutes

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    const newPost = await FeedPost.create({ user: req.user.id, content, imageUrl });

    // Force refresh cache for everyone when NEW content is added
    const redis = getRedis();
    if (redis) await redis.del(CACHE_KEY);

    res.status(201).json({ success: true, data: newPost });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) return res.json({ success: true, from: 'redis', data: JSON.parse(cached) });
    }

    const posts = await FeedPost.find().sort('-createdAt').limit(50);
    if (redis) await redis.set(CACHE_KEY, JSON.stringify(posts), { EX: CACHE_TTL });

    res.json({ success: true, from: 'db', data: posts });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.likePost = async (req, res) => {
    try {
        // ATOMIC UPDATE: We don't fetch-then-save, we let MongoDB handle it
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        const index = post.likes.indexOf(req.user.id);
        const update = index === -1
            ? { $addToSet: { likes: req.user.id } }
            : { $pull: { likes: req.user.id } };

        await FeedPost.updateOne({ _id: req.params.id }, update);

        // WE DO NOT DELETE CACHE HERE.
        // This is how 10M user apps scale. Reading slightly stale counts is okay
        // as long as the user sees their own local update instantly.

        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        await FeedPost.updateOne(
            { _id: req.params.id },
            { $push: { comments: { user: req.user.id, text: req.body.text } } }
        );
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
