const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const nodeID3 = require('node-id3');
const app = express();
const port = 3000;

// 添加静态文件服务
app.use(express.static(path.join(__dirname)));

// 音乐搜索接口
app.get('/api/songs', async (req, res) => {
    try {
        const { msg, n } = req.query;
        const response = await axios.get(`https://www.hhlqilongzhu.cn/api/dg_QQmusicflac.php?msg=${encodeURIComponent(msg || '')}&n=${n || ''}&type=json`);

        const songsWithDownloadStatus = await Promise.all(response.data.data.map(async song => {
            const downloaded = await checkSongDownloaded(song);
            return {
                ...song,
                downloaded
            };
        }));

        res.json({
            ...response.data,
            data: songsWithDownloadStatus
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ error: '请求出错' });
    }
});

// 下载接口
// 提取音乐保存方法
async function saveMusicFile(url, fileName) {
    try {
        const artistDir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(artistDir)) {
            fs.mkdirSync(artistDir, { recursive: true });
        }
        const safeFileName = fileName.replace(/[\\/]/g, '-');

        const filePath = path.join(artistDir, safeFileName);

        const musicResponse = await axios.get(url, { responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        musicResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                resolve(filePath);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('音乐下载请求出错:', error);
        return Promise.reject(error);
    }

}

// 提取设置音乐信息方法
function setMusicTags(filePath, songData) {
    const tags = {
        title: songData.song_name || songData.name,
        artist: songData.song_singer || songData.artistsname,
        album: '',
    };

    return new Promise((resolve, reject) => {
        nodeID3.write(tags, filePath, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// 修改后的下载接口
app.get('/api/download', async (req, res) => {
    try {
        const { msg, n } = req.query;
        const response = await axios.get(`https://www.hhlqilongzhu.cn/api/dg_QQmusicflac.php?msg=${encodeURIComponent(msg)}&n=${n}&type=json`);
        const songData = response.data.data;

        const fileName = `${songData.song_name}-${songData.song_singer}.mp3`;

        const filePath = await saveMusicFile(songData.music_url, fileName);
        await setMusicTags(filePath, songData);

        res.json({
            success: true,
            message: '下载成功',
            filePath,
            artist: songData.song_singer
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ success: false, error: '请求出错' });
    }
});

// 热歌下载接口
app.get('/api/downloadHot', async (req, res) => {
    try {
        const { id, name, artist } = req.query;
        if (!id || !name || !artist) {
            throw new Error('缺少必要参数');
        }

        const link = `https://www.hhlqilongzhu.cn/api/QQmusic_ck/music_bfq/API/api.php?id=${id}&type=mp3`;

        const fileName = `${name}-${artist}.mp3`;

        const filePath = await saveMusicFile(link, fileName);
        await setMusicTags(filePath, {
            song_name: name,
            song_singer: artist
        });

        res.json({
            success: true,
            message: '下载成功',
            filePath,
            artist: name
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ success: false, error: error.message || '请求出错' });
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


// 新增歌单搜索接口
app.get('/api/playlist', async (req, res) => {
    try {
        const { listId } = req.query;
        const response = await axios.get(`https://www.hhlqilongzhu.cn/api/dg_qqlist_sou.php?List_id=${listId}&n=&msg=&type=2`);

        const songsWithDownloadStatus = await Promise.all(response.data.data.map(async song => {
            const downloaded = await checkSongDownloaded(song);
            return {
                ...song,
                downloaded
            };
        }));

        res.json({
            ...response.data,
            data: songsWithDownloadStatus
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ error: '请求出错' });
    }
});

// 新增热歌榜接口
app.get('/api/hot', async (req, res) => {
    try {
        const response = await axios.get('https://www.hhlqilongzhu.cn/api/QQmusic_ck/music_bfq/API/index.php?sortAll=%E7%83%AD%E6%AD%8C%E6%A6%9C');

        const songsWithDownloadStatus = await Promise.all(response.data.map(async song => {
            const downloaded = await checkSongDownloaded(song);
            return {
                ...song,
                downloaded
            };
        }));

        res.json({
            data: songsWithDownloadStatus
        });
    } catch (error) {
        console.error('请求出错:', error);
        res.status(500).json({ error: '请求出错' });
    }
});

// 提取检查歌曲是否下载方法
async function checkSongDownloaded(song) {
    const fileName = `${song.song_title || song.title || song.name}-${song.song_singer || song.singer || song.artistsname}.mp3`;
    const filePath = path.join(__dirname, 'downloads', fileName);
    return fs.existsSync(filePath);
}


// 新增本地歌曲接口
app.get('/api/local', async (req, res) => {
    try {
        const downloadsDir = path.join(__dirname, 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            return res.json({ data: [] });
        }

        const files = fs.readdirSync(downloadsDir);
        const songs = files
            .filter(file => file.endsWith('.mp3'))
            .map(file => {
                const [name, artist] = file.replace('.mp3', '').split('-');
                return {
                    name: decodeURIComponent(name),
                    artist: decodeURIComponent(artist),
                    path: path.join(downloadsDir, file)
                };
            });

        res.json({ data: songs });
    } catch (error) {
        console.error('获取本地歌曲出错:', error);
        res.status(500).json({ error: '获取本地歌曲出错' });
    }
});

// 新增删除歌曲接口
app.get('/api/delete', async (req, res) => {
    try {
        const { path: filePath } = req.query;
        if (!filePath) {
            return res.status(400).json({ success: false, error: '缺少文件路径' });
        }

        const decodedPath = decodeURIComponent(filePath);
        if (!fs.existsSync(decodedPath)) {
            return res.json({ success: true, message: '文件不存在' });
        }

        fs.unlinkSync(decodedPath);
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        console.error('删除歌曲出错:', error);
        res.status(500).json({ success: false, error: '删除歌曲出错' });
    }
});