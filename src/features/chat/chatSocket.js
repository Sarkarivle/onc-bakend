const Message = require('./models/messageModel');
const Conversation = require('./models/conversationModel');
const Block = require('./models/blockModel');
const { updateConversationSummary, resetUnreadCount, queueStatusUpdate } = require('../../utils/chatUtils');
const { normalize } = require('../../utils/phoneUtils');
const analytics = require('../../services/analyticsService');
const { getRedis } = require('../../config/redis');

module.exports = (io) => {
    io.on('connection', async (socket) => {
        const myPhone = socket.handshake.query.phone ? normalize(socket.handshake.query.phone) : null;
        const redis = getRedis();

        if (myPhone) {
            socket.userPhone = myPhone;
            socket.join(`user_${myPhone}`);
            console.log(`📱 User joined chat: ${myPhone} (ID: ${socket.id})`);

            // Mark online in Redis
            if (redis) {
                try {
                    await redis.sAdd('online_users', myPhone);
                    // Notify others
                    io.emit('user_status_change', { phone: myPhone, isOnline: true });

                    // Auto-deliver pending messages
                    const pending = await Message.find({ receiverPhone: myPhone, isDelivered: false });
                    if (pending.length > 0) {
                        await Message.updateMany({ _id: { $in: pending.map(m => m._id) } }, { $set: { isDelivered: true } });
                        // Notify senders
                        pending.forEach(m => {
                            io.to(`user_${m.senderPhone}`).emit('message_delivered', { messageId: m._id, localId: m.localId });
                        });
                    }
                } catch (err) {
                    console.error('❌ Redis Online Error:', err);
                }
            }
        }

        socket.on('set_online', async (phone) => {
            const normalizedPhone = normalize(phone);
            if (!normalizedPhone) return;
            socket.userPhone = normalizedPhone;
            socket.join(`user_${normalizedPhone}`);
            if (redis) {
                await redis.sAdd('online_users', normalizedPhone);
                io.emit('user_status_change', { phone: normalizedPhone, isOnline: true });

                // Mark pending messages as delivered
                await Message.updateMany({ receiverPhone: normalizedPhone, isDelivered: false }, { $set: { isDelivered: true } });
            }
        });

        socket.on('send_message', async (data, callback) => {
            try {
                const { receiverPhone, message, type, localId, imageUrl, audioUrl, replyToId, replyText, replyType } = data;

                const sPhone = normalize(socket.userPhone || data.senderPhone);
                const rPhone = normalize(receiverPhone);

                if (!sPhone || !rPhone) {
                    if (callback) callback({ success: false, error: 'Invalid sender or receiver' });
                    return;
                }

                const roomId = [sPhone, rPhone].sort().join('_');

                // Check for blocks
                const block = await Block.findOne({
                    $or: [
                        { blockerPhone: sPhone, blockedPhone: rPhone },
                        { blockerPhone: rPhone, blockedPhone: sPhone }
                    ]
                });

                if (block) {
                    if (callback) callback({ success: false, error: 'Blocked' });
                    return;
                }

                // Check if receiver is online to set initial isDelivered status
                let isReceiverOnline = false;
                if (redis) {
                    isReceiverOnline = await redis.sIsMember('online_users', rPhone);
                }

                const newMsg = new Message({
                    roomId,
                    senderPhone: sPhone,
                    receiverPhone: rPhone,
                    message,
                    type: type || 'text',
                    localId,
                    imageUrl,
                    audioUrl,
                    replyToId,
                    replyText,
                    replyType,
                    isDelivered: isReceiverOnline,
                    timestamp: new Date()
                });

                await newMsg.save();

                // Broadcast to both users
                io.to(`user_${sPhone}`).emit('receive_message', newMsg);
                io.to(`user_${rPhone}`).emit('receive_message', newMsg);

                // Update conversation summary
                updateConversationSummary(newMsg);
                analytics.trackMessage();

                if (callback) callback({ success: true, message: newMsg });
            } catch (e) {
                console.error("❌ Socket Send Error:", e);
                if (callback) callback({ success: false, error: e.message });
            }
        });

        socket.on('mark_delivered', async (data) => {
            const { messageId, localId, senderPhone } = data;
            if (!messageId && !localId) return;

            try {
                const query = messageId ? { _id: messageId } : { localId: localId, senderPhone: normalize(senderPhone) };
                await Message.updateOne(query, { $set: { isDelivered: true } });

                if (senderPhone) {
                    io.to(`user_${normalize(senderPhone)}`).emit('message_delivered', { messageId, localId });
                }
            } catch (e) {}
        });

        socket.on('mark_opened', async (data) => {
            const { messageId, senderPhone } = data;
            if (!messageId) return;

            try {
                await Message.updateOne({ _id: messageId }, { $set: { isOpened: true, isDelivered: true } });
                if (senderPhone) {
                    io.to(`user_${normalize(senderPhone)}`).emit('message_opened', { messageId });
                }
            } catch (e) {}
        });

        socket.on('typing', (data) => {
            const rPhone = normalize(data.receiverPhone || data.otherPhone);
            if (rPhone) {
                io.to(`user_${rPhone}`).emit('typing', { senderPhone: socket.userPhone });
            }
        });

        socket.on('stop_typing', (data) => {
            const rPhone = normalize(data.receiverPhone || data.otherPhone);
            if (rPhone) {
                io.to(`user_${rPhone}`).emit('stop_typing', { senderPhone: socket.userPhone });
            }
        });

        socket.on('mark_chat_seen', async (data) => {
            try {
                const m = normalize(socket.userPhone);
                const o = normalize(data.partnerPhone || data.otherPhone);
                if (!m || !o) return;

                const roomId = [m, o].sort().join('_');

                await Message.updateMany(
                    { roomId, receiverPhone: m, isOpened: false },
                    { $set: { isOpened: true, isDelivered: true } }
                );

                await resetUnreadCount(m, o);
                io.to(`user_${o}`).emit('messages_seen', { partnerPhone: m });
            } catch (e) {
                console.error('❌ Mark Seen Error:', e);
            }
        });

        socket.on('disconnect', async () => {
            if (socket.userPhone) {
                console.log(`🔌 User disconnected: ${socket.userPhone}`);
                if (redis) {
                    try {
                        await redis.sRem('online_users', socket.userPhone);
                        io.emit('user_status_change', { phone: socket.userPhone, isOnline: false });
                    } catch (err) {
                        console.error('❌ Redis Offline Error:', err);
                    }
                }
            }
        });
    });
};
