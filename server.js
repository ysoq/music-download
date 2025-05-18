const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// 添加静态文件服务
app.use(express.static(path.join(__dirname)));

// 定义转发接口
app.get('/api/songs', async (req, res) => {
    try {
        const { msg, n } = req.query;
        const response = await axios.get(`https://www.hhlqilongzhu.cn/api/dg_QQmusicflac.php?msg=${encodeURIComponent(msg || '')}&n=${n || ''}&type=json`);
        res.json(response.data);
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ error: '请求出错' });
    }
});

// 修改后的下载接口
app.get('/api/download', async (req, res) => {
    try {
        const { msg, n } = req.query;
        const response = await axios.get(`https://www.hhlqilongzhu.cn/api/dg_QQmusicflac.php?msg=${encodeURIComponent(msg)}&n=${n}&type=json`);
        const songData = response.data.data;
        
        // 下载音乐文件
        const musicResponse = await axios.get(songData.music_url, { responseType: 'stream' });
        const fileName = `${songData.song_name}-${songData.song_singer}.mp3`;
        const filePath = path.join(__dirname, 'downloads', fileName);
        
        // 确保downloads目录存在
        if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
            fs.mkdirSync(path.join(__dirname, 'downloads'));
        }
        
        const writer = fs.createWriteStream(filePath);
        musicResponse.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                res.json({ success: true, message: '下载成功', filePath });
                resolve();
            });
            
            writer.on('error', (err) => {
                console.error('下载失败:', err);
                res.status(500).json({ success: false, error: '下载失败' });
                reject(err);
            });
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ success: false, error: '请求出错' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log(`访问页面: http://localhost:${port}/index.html`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${port} 已被占用，请尝试其他端口`);
    } else {
        console.error('服务器启动失败:', err);
    }
});