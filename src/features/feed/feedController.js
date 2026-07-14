const FeedPost = require('./feedModel');
const { getRedis } = require('../../config/redis');

// Fail-safe Local Memory Cache
let localCache = null;
let localCacheTime = null;
const CACHE_KEY = 'jobo:feed:all';
const CACHE_TTL = 300; // 5 Minutes in seconds

exports.createPost = async (req, res) => {
  try {
    const { content, imageUrl } = req.body;
    const newPost = await FeedPost.create({
      user: req.user.id,
      content,
      imageUrl
    });

    // Invalidate Cache
    const redis = getRedis();
    if (redis) await redis.del(CACHE_KEY);
    localCache = null;

    res.status(201).json({ success: true, data: newPost });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const redis = getRedis();

    // 1. Try REDIS (Global Cache)
    if (redis) {
      const cachedData = await redis.get(CACHE_KEY);
      if (cachedData) {
        return res.status(200).json({
          success: true,
          from: 'redis',
          data: JSON.parse(cachedData)
        });
      }
    }

    // 2. Try Local Memory (Fall-back)
    if (localCache && (Date.now() - localCacheTime < CACHE_TTL * 1000)) {
       return res.status(200).json({ success: true, from: 'memory', data: localCache });
    }

    // 3. Database fetch (If no cache)
    const posts = await FeedPost.find().sort('-createdAt').limit(100);

    // 4. Update both caches
    if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify(posts), { EX: CACHE_TTL });
    }
    localCache = posts;
    localCacheTime = Date.now();

    res.status(200).json({ success: true, from: 'db', data: posts });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.likePost = async (req, res) => {
    try {
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        const index = post.likes.indexOf(req.user.id);
        if (index === -1) {
            post.likes.push(req.user.id);
        } else {
            post.likes.splice(index, 1);
        }

        await post.save();

        // Invalidate Cache after interaction
        const redis = getRedis();
        if (redis) await redis.del(CACHE_KEY);
        localCache = null;

        res.json({ success: true, likes: post.likes.length, isLiked: index === -1 });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const post = await FeedPost.findById(req.params.id);
        if (!post) throw new Error('Post not found');

        post.comments.push({
            user: req.user.id,
            text,
            createdAt: Date.now()
        });

        await post.save();

        // Invalidate Cache
        const redis = getRedis();
        if (redis) await redis.del(CACHE_KEY);
        localCache = null;

        res.status(201).json({ success: true, data: post.comments });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
