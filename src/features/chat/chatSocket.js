const Message = require('./models/messageModel');
const Conversation = require('./models/conversationModel');
const Block = require('./models/blockModel');
const { updateConversationSummary, resetUnreadCount, queueStatusUpdate } = require('../../utils/chatUtils');
const { normalize } = require('../../utils/phoneUtils');
const analytics = require('../../services/analyticsService');

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 Socket connection attempt:', socket.id);
        const myPhone = socket.handshake.query.phone ? normalize(socket.handshake.query.phone) : null;

        if (myPhone) {
            socket.userPhone = myPhone;
            socket.join(`user_${myPhone}`);
            console.log(`📱 User joined chat room: user_${myPhone}`);
        } else {
            console.warn('⚠️ Socket connected without phone in query. ID:', socket.id);
        }

        socket.on('send_message', async (data, callback) => {
            console.log('✉️ Incoming message from', socket.userPhone, 'to', data.receiverPhone);
            try {
                const { receiverPhone, message, type, localId, imageUrl, audioUrl, replyToId, replyText, replyType } = data;
                const sPhone = normalize(socket.userPhone);
                const rPhone = normalize(receiverPhone);
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
                    timestamp: new Date()
                });

                await newMsg.save();

                // Emit to both
                io.to(`user_${sPhone}`).emit('receive_message', newMsg);
                io.to(`user_${rPhone}`).emit('receive_message', newMsg);

                // Update summary
                updateConversationSummary(newMsg);
                analytics.trackMessage();

                if (callback) callback({ success: true, message: newMsg });
            } catch (e) {
                console.error("Socket Send Error:", e);
                if (callback) callback({ success: false });
            }
        });

        socket.on('typing', (data) => {
            const rPhone = normalize(data.receiverPhone);
            io.to(`user_${rPhone}`).emit('typing', { senderPhone: socket.userPhone });
        });

        socket.on('stop_typing', (data) => {
            const rPhone = normalize(data.receiverPhone);
            io.to(`user_${rPhone}`).emit('stop_typing', { senderPhone: socket.userPhone });
        });

        socket.on('mark_chat_seen', async (data) => {
            try {
                const m = normalize(socket.userPhone);
                const o = normalize(data.partnerPhone);
                const roomId = [m, o].sort().join('_');

                await Message.updateMany(
                    { roomId, receiverPhone: m, isOpened: false },
                    { $set: { isOpened: true, isDelivered: true } }
                );

                await resetUnreadCount(m, o);
                io.to(`user_${o}`).emit('messages_seen', { partnerPhone: m });
            } catch (e) {}
        });

        socket.on('disconnect', () => {
            console.log(`🔌 User disconnected: ${socket.userPhone}`);
        });
    });
};
