// server.js - 完美對接 ApexForge 專用雲端後端 (支援雲端部署環境)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. 定義資料庫模型 (Schema & Model)
const userSchema = new mongoose.Schema({
    username: String,
    balance: Number
});
const User = mongoose.model('User', userSchema);

// 2. 連接雲端資料庫 (MongoDB Atlas)
// 安全版：優先讀取雲端保險箱(環境變數)，本地找不到才用明碼
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://herry11089_db_user:WgZL2povA5SDl1P4@cluster0.ako9vdv.mongodb.net/?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ 已連接雲端資料庫');
        
        // 初始化檢查：如果資料庫是空的，自動幫 herry 建立錢包
        User.findOne({ username: 'herry' }).then(user => {
            if (!user) {
                User.create({ username: 'herry', balance: 50000 });
                console.log('✨ 初始玩家 [herry] 已建立，初始餘額 $50,000');
            } else {
                console.log('✅ 讀取到玩家 [herry]，目前餘額:', user.balance);
            }
        });
    })
    .catch(err => console.error('❌ 連線失敗:', err));

// 3. API 路由：同步餘額 (對應前端 /api/user/balance)
app.get('/api/user/balance', async (req, res) => {
    try {
        const user = await User.findOne({ username: 'herry' });
        res.json({ balance: user ? user.balance : 0 });
    } catch (err) {
        res.status(500).json({ error: "資料庫讀取失敗" });
    }
});

// 4. API 路由：投注計算與隨機路徑生成 (對應前端 /api/plinko/bet)
app.post('/api/plinko/bet', async (req, res) => {
    try {
        const { betAmount, rows, risk, clientSeed } = req.body;
        let user = await User.findOne({ username: 'herry' });
        
        if (!user) {
            return res.status(404).json({ error: "找不到玩家帳號" });
        }
        if (user.balance < betAmount) {
            return res.status(400).json({ error: "餘額不足，請儲值！" });
        }

        // --- 核心隨機路徑生成 (0=左, 1=右) ---
        let path = [];
        let finalIndex = 0;
        for (let i = 0; i < rows; i++) {
            const direction = Math.random() < 0.5 ? 0 : 1;
            path.push(direction);
            finalIndex += direction; // 計算最終落點位置
        }

        // 完整倍率資料庫
        const MULTIPLIER_DATABASE = {
            8: { low: [5.6, 1.6, 1.1, 1, 0.5, 1, 1.1, 1.6, 5.6], medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13], high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29] },
            9: { low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6], medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18], high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43] },
            10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9], medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22], high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76] },
            11: { low: [8.9, 3, 1.7, 1.2, 1, 0.7, 0.7, 1, 1.2, 1.7, 3, 8.9], medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24], high: [120, 14, 4.3, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 4.3, 14, 120] },
            12: { low: [10, 4, 2, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 2, 4, 10], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33], high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170] },
            13: { low: [10, 4, 2, 1.6, 1.2, 1, 0.7, 0.7, 1, 1.2, 1.6, 2, 4, 10], medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43], high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260] },
            14: { low: [11, 5, 3, 2, 1.4, 1, 0.5, 1, 0.5, 1, 1.4, 2, 3, 5, 11], medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58], high: [420, 56, 14, 5.3, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 5.3, 14, 56, 420] },
            15: { low: [11, 5, 3, 2, 1.6, 1.2, 1, 0.7, 0.7, 1, 1.2, 1.6, 2, 3, 5, 11], medium: [88, 18, 9, 5, 2, 1.3, 0.6, 0.5, 0.5, 0.6, 1.3, 2, 5, 9, 18, 88], high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620] },
            16: { low: [16, 9, 2, 1.4, 1.2, 1.1, 1, 0.5, 1, 0.5, 1, 1.1, 1.2, 1.4, 2, 9, 16], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000] }
        };

        let multiplier = 1.0;
        if (MULTIPLIER_DATABASE[rows] && MULTIPLIER_DATABASE[rows][risk]) {
            multiplier = MULTIPLIER_DATABASE[rows][risk][finalIndex] || 1.0;
        }

        const payout = betAmount * multiplier;
        
        // 扣除下注額並發放獎金（直接存入 MongoDB 雲端）
        user.balance = user.balance - betAmount + payout;
        await user.save();
        
        // 將結算結果回傳前端進行動態繪製
        res.json({
            success: true,
            newBalance: user.balance,
            path: path,
            finalIndex: finalIndex,
            multiplier: multiplier,
            payout: payout,
            nonce: 0
        });

    } catch (err) {
        console.error("後端執行異常:", err);
        res.status(500).json({ error: "伺服器內部錯誤" });
    }
});

// 5. 動態監聽 Port (關鍵修改：優先採用環境變數，以適應 Render 部署環境)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API Engine Running on port ${PORT}`));