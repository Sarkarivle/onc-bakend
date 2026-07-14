const Message = require('./models/messageModel');
const User = require('../auth/userModel');
const Block = require('./models/blockModel');
const RecentPhoto = require('./models/recentPhotoModel');
const ConversationMetadata = require('./models/conversationMetadataModel');
const Conversation = require('./models/conversationModel');
const { updateConversationSummary, resetUnreadCount } = require('../../utils/chatUtils');
const { calculateDistance } = require('../../utils/locationUtils');
const { normalize, phoneQuery } = require('../../utils/phoneUtils');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

async function emitModerationChange(req, { blockerPhone, blockedPhone, isBlocked }) {
    const b1 = normalize(blockerPhone);
    const b2 = normalize(blockedPhone);
    if (!b1 || !b2) return;

    const io = req.app.get('io');
    const roomId = [b1, b2].sort().join('_');
    const type = isBlocked ? 'block_event' : 'unblock_event';

    const systemMsg = new Message({
        roomId,
        senderPhone: b1,
        receiverPhone: b2,
        message: isBlocked ? 'This chat was blocked' : 'This chat was unblocked',
        type,
        timestamp: new Date()
    });
    await systemMsg.save();
    await updateConversationSummary(systemMsg);

    if (!io) return;

    const stateInfo = { blockerPhone: b1, blockedPhone: b2, isBlocked };
    io.to(`user_${b1}`).emit('moderation_state_updated', stateInfo);
    io.to(`user_${b2}`).emit('moderation_state_updated', stateInfo);

    const senderMsg = systemMsg.toObject();
    senderMsg.message = isBlocked ? 'You blocked this user' : 'You unblocked this user';
    io.to(`user_${b1}`).emit('receive_message', senderMsg);

    const receiverMsg = systemMsg.toObject();
    receiverMsg.message = isBlocked ? 'This user blocked you' : 'This user unblocked you';
    io.to(`user_${b2}`).emit('receive_message', receiverMsg);
}

exports.getInbox = async (req, res) => {
    try {
        let phone = normalize(req.params.phone);
        if (req.user && !req.user.role) phone = normalize(req.user.phone);
        const page = Math.max(1, parseInt(req.query.page || 1));
        const limit = Math.max(1, parseInt(req.query.limit || 20));
        const skip = (page - 1) * limit;
        const variations = [phone, `+91${phone}`, `91${phone}`];

        const caller = await User.findOne({
            phone: { $in: variations }
        }, 'lat lng location').lean();
        const userLat = caller?.lat || caller?.location?.coordinates?.[1];
        const userLng = caller?.lng || caller?.location?.coordinates?.[0];

        const conversations = await Conversation.find({
                userPhone: { $in: variations }
            })
            .sort({ 'lastMessage.timestamp': -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        if (conversations.length === 0) {
            return res.json({ totalUnread: 0, chats: [] });
        }

        const partnerPhones = conversations.map(c => c.partnerPhone);
        const searchVariations = partnerPhones.reduce((acc, p) => {
            const n = normalize(p);
            acc.push(n, `+91${n}`, `91${n}`);
            return acc;
        }, []);

        const [partners, blocks, metadata, unreadAgg] = await Promise.all([
            User.find({
                phone: { $in: searchVariations }
            }, 'phone name isOnline isVerified city area position lat lng location profileImages').lean(),
            Block.find({
                $or: [{
                    blockerPhone: phone,
                    blockedPhone: { $in: partnerPhones }
                }, {
                    blockerPhone: { $in: partnerPhones },
                    blockedPhone: phone
                }]
            }).lean(),
            ConversationMetadata.find({
                phone: phone,
                partnerPhone: { $in: partnerPhones }
            }).lean(),
            page === 1 ? Conversation.aggregate([
                { $match: { userPhone: phone } },
                { $group: { _id: null, total: { $sum: "$unreadCount" } } }
            ]) : Promise.resolve([])
        ]);

        const userMap = {};
        partners.forEach(u => userMap[normalize(u.phone)] = u);
        const metaMap = {};
        metadata.forEach(m => metaMap[normalize(m.partnerPhone)] = m);

        const io = req.app.get('io');
        const redis = req.app.get('redis') || (req.app.get('io') ? null : null); // Fallback logic
        // In ONC, redis is available via getRedis()
        const { getRedis } = require('../../config/redis');
        const redisClient = getRedis();

        let onlinePhones = [];
        try {
            if (redisClient) onlinePhones = await redisClient.sMembers('online_users');
        } catch (err) {
            console.error("Redis Inbox Status Error:", err.message);
        }
        const onlineSet = new Set(onlinePhones);

        const chats = conversations.map(conv => {
            const other = normalize(conv.partnerPhone);
            const u = userMap[other] || {};
            const meta = metaMap[other] || {};
            const block = blocks.find(b => (normalize(b.blockerPhone) === phone && normalize(b.blockedPhone) === other) || (normalize(b.blockerPhone) === other && normalize(b.blockedPhone) === phone));
            const uLat = u.lat || u.location?.coordinates?.[1];
            const uLng = u.lng || u.location?.coordinates?.[0];
            const distStr = (userLat && userLng && uLat && uLng) ? calculateDistance(userLat, userLng, uLat, uLng) : "";

            return {
                phone: other,
                msg: conv.lastMessage?.message || '',
                type: conv.lastMessage?.type || 'text',
                timestamp: conv.lastMessage?.timestamp || conv.updatedAt || new Date(),
                name: u.name || 'User',
                unread: conv.unreadCount || 0,
                isOnline: onlineSet.has(other) || u.isOnline || false,
                isVerified: u.isVerified || false,
                isBlocked: !!block,
                iBlocked: block?.blockerPhone === phone,
                city: (u.area || u.city || 'Nearby'),
                distance: distStr,
                position: u.position || '',
                isFavourite: meta.isFavourite || false,
                isMuted: meta.isMuted || false,
                isHidden: meta.isHidden || false,
                lastClearedAt: meta.lastClearedAt,
                profileImage: u.profileImages && u.profileImages.length > 0 ? u.profileImages[0] : null
            };
        }).filter(c => !c.isHidden || (new Date(c.timestamp) > new Date(c.lastClearedAt || 0)));

        let totalUnread = unreadAgg.length > 0 ? unreadAgg[0].total : 0;
        res.json({ totalUnread, chats });
    } catch (e) {
        console.error("Inbox Scale Error:", e);
        res.status(500).json({ chats: [], totalUnread: 0 });
    }
};

exports.getChatHistory = async (req, res) => {
    try {
        const p1 = normalize(req.params.p1);
        const p2 = normalize(req.params.p2);
        const { page = 1, limit = 50, before } = req.query;
        const roomId = [p1, p2].sort().join('_');
        const possibleRoomIds = [roomId, p1 + '_' + p2, p2 + '_' + p1];
        const parsedLimit = Math.min(Math.max(parseInt(limit), 1), 100);
        const parsedPage = Math.max(parseInt(page), 1);
        const messageQuery = {
            roomId: { $in: possibleRoomIds },
            deletedBy: { $nin: [p1, `+91${p1}`, `91${p1}`] }
        };
        const beforeDate = before ? new Date(before) : null;
        if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
            messageQuery.timestamp = { $lt: beforeDate };
        }

        const [chats, block, partner] = await Promise.all([
            Message.find(messageQuery)
            .sort({ timestamp: -1 })
            .skip(beforeDate ? 0 : (parsedPage - 1) * parsedLimit)
            .limit(parsedLimit),
            Block.findOne({
                $or: [{ blockerPhone: p1, blockedPhone: p2 }, { blockerPhone: p2, blockedPhone: p1 }]
            }),
            User.findOne(phoneQuery(p2), 'isDeactivated accountStatus')
        ]);

        const messages = chats; // Remove .reverse() for Flutter ListView(reverse: true)
        const isBlocked = !!block;
        const blockerPhone = block ? block.blockerPhone : null;
        const isPartnerDeactivated = partner ? (partner.isDeactivated || partner.accountStatus === 'Deactivated') : false;

        // Check if partner is online using Redis
        const { getRedis } = require('../../config/redis');
        const redis = getRedis();
        let isPartnerOnline = false;
        if (redis) {
            isPartnerOnline = await redis.sIsMember('online_users', p2);
        }

        if (parsedPage === 1 && !beforeDate) {
            res.json({
                messages,
                isBlocked,
                blockerPhone,
                isPartnerDeactivated,
                isPartnerOnline,
                hasReviewed: false // Simplified
            });
        } else {
            res.json(messages);
        }
    } catch (e) {
        res.status(500).json(req.query.page > 1 ? [] : { messages: [] });
    }
};

exports.handleFileUpload = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false });
        const fileUrl = `/api/v1/chat/media/${req.file.filename}`;
        const phone = (req.user && !req.user.role) ? req.user.phone : normalize(req.body.phone || req.query.phone);
        const type = req.body.type || req.query.type;
        if (phone && (type === 'image' || type === 'video')) {
            await new RecentPhoto({ phone, imageUrl: fileUrl }).save();
        }
        res.json({ success: true, imageUrl: fileUrl });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

exports.markSeen = async (req, res) => {
    try {
        let m = req.body.myPhone;
        if (req.user && !req.user.role) m = req.user.phone;
        m = normalize(m);
        const o = normalize(req.body.otherPhone);
        const roomId = [m, o].sort().join('_');
        const possibleRoomIds = [roomId, m + '_' + o, o + '_' + m];
        const phoneVariations = [m, `+91${m}`, `91${m}`];

        await Message.updateMany({
            roomId: { $in: possibleRoomIds },
            receiverPhone: { $in: phoneVariations },
            isOpened: false,
            isViewOnce: false
        }, { isOpened: true, isDelivered: true });

        await Message.updateMany({
            roomId: { $in: possibleRoomIds },
            receiverPhone: { $in: phoneVariations },
            isDelivered: false,
            isViewOnce: true
        }, { isDelivered: true });

        await resetUnreadCount(m, o);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.updateMetadata = async (req, res) => {
    try {
        let { phone, partnerPhone, isMuted, isFavourite, isHidden } = req.body;
        if (req.user && !req.user.role) phone = req.user.phone;
        const p = normalize(phone), pp = normalize(partnerPhone);
        const update = {};
        if (isMuted !== undefined) update.isMuted = isMuted;
        if (isFavourite !== undefined) update.isFavourite = isFavourite;
        if (isHidden !== undefined) {
            update.isHidden = isHidden;
            if (isHidden) update.lastClearedAt = new Date();
        }
        const meta = await ConversationMetadata.findOneAndUpdate({
            phone: p, partnerPhone: pp
        }, update, { upsert: true, new: true });
        res.json({ success: true, meta });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.blockUser = async (req, res) => {
    try {
        let b1 = req.body.blockerPhone;
        if (req.user && !req.user.role) b1 = req.user.phone;
        b1 = normalize(b1);
        const b2 = normalize(req.body.blockedPhone);
        await Block.findOneAndUpdate({
            blockerPhone: b1, blockedPhone: b2
        }, { reason: req.body.reason, timestamp: new Date() }, { upsert: true });
        await emitModerationChange(req, { blockerPhone: b1, blockedPhone: b2, isBlocked: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.unblockUser = async (req, res) => {
    try {
        let b1 = req.body.blockerPhone;
        if (req.user && !req.user.role) b1 = req.user.phone;
        b1 = normalize(b1);
        const b2 = normalize(req.body.blockedPhone);
        await Block.findOneAndDelete({ blockerPhone: b1, blockedPhone: b2 });
        await emitModerationChange(req, { blockerPhone: b1, blockedPhone: b2, isBlocked: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.checkBlock = async (req, res) => {
    try {
        const p1 = normalize(req.params.p1), p2 = normalize(req.params.p2);
        const b = await Block.findOne({
            $or: [{ blockerPhone: p1, blockedPhone: p2 }, { blockerPhone: p2, blockedPhone: p1 }]
        });
        res.json({ success: true, isBlocked: !!b, blockerPhone: b ? b.blockerPhone : null });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.getRecentPhotos = async (req, res) => {
    try {
        let phone = normalize(req.params.phone);
        if (req.user && !req.user.role) phone = normalize(req.user.phone);
        res.json({
            success: true,
            photos: await RecentPhoto.find(phoneQuery(phone)).sort({ timestamp: -1 }).limit(20)
        });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};

exports.getBlockedList = async (req, res) => {
    try {
        let phone = normalize(req.params.phone);
        if (req.user && !req.user.role) phone = normalize(req.user.phone);
        const blocks = await Block.find({ blockerPhone: { $in: [phone, `+91${phone}`, `91${phone}`] } }).lean();
        const partnerPhones = blocks.map(b => b.blockedPhone);
        const searchPhones = partnerPhones.reduce((acc, p) => {
            const n = normalize(p);
            acc.push(n, `+91${n}`, `91${n}`);
            return acc;
        }, []);

        const blockedUsers = await User.find({
            phone: { $in: searchPhones }
        }, 'phone name profileImages').lean();

        const result = blockedUsers.map(u => ({
            phone: u.phone,
            name: u.name,
            profileImage: u.profileImages && u.profileImages.length > 0 ? u.profileImages[0] : null
        }));
        res.json({ success: true, blockedUsers: result });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

exports.deletePhoto = async (req, res) => {
    try {
        const photo = await RecentPhoto.findById(req.params.messageId);
        if (photo) {
            if (req.user && !req.user.role && normalize(req.user.phone) !== normalize(photo.phone)) {
                return res.status(403).json({ success: false, message: "Unauthorized" });
            }
            const filePath = path.join(process.cwd(), 'uploads', photo.imageUrl.split('/').pop());
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await RecentPhoto.findByIdAndDelete(req.params.messageId);
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: true });
    }
};

exports.deleteRecentPhotoByUrl = async (req, res) => {
    try {
        let phone = normalize(req.body.phone);
        if (req.user && !req.user.role) phone = normalize(req.user.phone);
        const url = req.body.imageUrl.split('?')[0];
        const photo = await RecentPhoto.findOne({ phone, imageUrl: url });
        if (photo) {
            const filePath = path.join(process.cwd(), 'uploads', url.split('/').pop());
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            await RecentPhoto.deleteOne({ _id: photo._id });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
};
