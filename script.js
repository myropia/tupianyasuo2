document.addEventListener('DOMContentLoaded', () => {
    // 等待库加载完成
    const checkLibrary = () => {
        if (typeof imageCompression !== 'undefined') {
            initializeApp();
        } else {
            setTimeout(checkLibrary, 100);
        }
    };

    // 设置超时
    setTimeout(() => {
        if (typeof imageCompression === 'undefined') {
            alert('图片压缩组件加载失败，请检查网络连接后刷新页面重试！');
        }
    }, 5000);

    checkLibrary();
});

function initializeApp() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('qualityValue');
    const originalPreview = document.getElementById('originalPreview');
    const compressedPreview = document.getElementById('compressedPreview');
    const originalSize = document.getElementById('originalSize');
    const compressedSize = document.getElementById('compressedSize');
    const downloadBtn = document.getElementById('downloadBtn');
    const controls = document.querySelector('.compression-controls');
    const previewContainer = document.querySelector('.preview-container');

    let originalFile = null;
    let compressedFile = null;

    // 点击上传区域触发文件选择
    dropZone.addEventListener('click', () => fileInput.click());

    // 处理文件拖放
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#007AFF';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ddd';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ddd';
        const files = e.dataTransfer.files;
        if (files.length) handleFile(files[0]);
    });

    // 处理文件选择
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    // 处理质量滑块变化
    qualitySlider.addEventListener('input', (e) => {
        qualityValue.textContent = `${e.target.value}%`;
        if (originalFile) compressImage(originalFile, e.target.value / 100);
    });

    // 处理文件
    async function handleFile(file) {
        try {
            if (!file.type.match(/image\/(jpeg|png)/i)) {
                alert('请上传 PNG 或 JPG 格式的图片！');
                return;
            }

            // 检查文件大小
            if (file.size > 50 * 1024 * 1024) { // 50MB
                alert('文件过大，请选择小于 50MB 的图片！');
                return;
            }

            originalFile = file;
            controls.style.display = 'block';
            previewContainer.style.display = 'flex';

            // 显示原始图片
            originalPreview.src = URL.createObjectURL(file);
            originalSize.textContent = `文件大小：${formatFileSize(file.size)}`;

            // 压缩图片
            await compressImage(file, qualitySlider.value / 100);
            
        } catch (error) {
            console.error('文件处理失败：', error);
            alert('文件处理失败，请重试！');
        }
    }

    // 压缩图片
    async function compressImage(file, quality) {
        try {
            // 首先检查文件大小
            const fileSizeMB = file.size / 1024 / 1024;
            
            // 根据文件大小动态调整压缩参数
            let targetSizeMB;
            let targetQuality = quality;
            
            if (fileSizeMB > 5) { // 大于 5MB 的图片
                targetSizeMB = Math.min(fileSizeMB * 0.3, 1); // 压缩到原大小的 30%
                targetQuality = Math.min(quality, 0.7); // 最大质量限制在 70%
            } else if (fileSizeMB > 2) { // 2-5MB 的图片
                targetSizeMB = Math.min(fileSizeMB * 0.5, 1); // 压缩到原大小的 50%
                targetQuality = Math.min(quality, 0.8); // 最大质量限制在 80%
            } else {
                targetSizeMB = Math.min(fileSizeMB * 0.7, 1); // 压缩到原大小的 70%
                targetQuality = quality;
            }
            
            const options = {
                maxSizeMB: targetSizeMB,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                quality: targetQuality,
                // 根据图片类型选择最佳压缩方式
                initialQuality: targetQuality,
                alwaysKeepResolution: false, // 允许降低分辨率以达到更好的压缩效果
                // 优化设置
                maxIteration: 10, // 增加压缩迭代次数
                webWorkerPath: undefined, // 使用默认 WebWorker
                onProgress: (progress) => {
                    console.log('压缩进度：', progress);
                }
            };

            // 如果是 PNG 图片，尝试转换为 JPEG 来获得更好的压缩效果
            if (file.type === 'image/png') {
                options.fileType = 'image/jpeg';
                options.initialQuality = Math.min(targetQuality, 0.85); // PNG 转 JPEG 时适当降低初始质量
            }

            console.log('开始压缩，参数：', options);
            
            // 添加超时处理
            const compressionPromise = imageCompression(file, options);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('压缩超时')), 30000);
            });

            compressedFile = await Promise.race([compressionPromise, timeoutPromise]);
            
            if (!compressedFile || compressedFile.size === 0) {
                throw new Error('压缩后的文件无效');
            }

            // 如果压缩效果不理想，尝试二次压缩
            if (compressedFile.size > file.size * 0.8) { // 如果压缩后仍然大于原文件的 80%
                console.log('压缩效果不理想，尝试二次压缩');
                options.quality = Math.min(targetQuality * 0.8, 0.6); // 降低 20% 质量，但不低于 0.6
                options.maxWidthOrHeight = 1600; // 适当降低分辨率
                compressedFile = await imageCompression(compressedFile, options);
            }

            compressedPreview.src = URL.createObjectURL(compressedFile);
            const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
            compressedSize.textContent = `文件大小：${formatFileSize(compressedFile.size)} (压缩率: ${compressionRatio}%)`;

            // 如果压缩后文件比原文件大，使用原文件
            if (compressedFile.size > file.size) {
                console.log('压缩后文件更大，使用原文件');
                compressedFile = file;
                compressedSize.textContent = `文件大小：${formatFileSize(file.size)} (保持原始大小)`;
            }

        } catch (error) {
            console.error('压缩失败：', error);
            
            // 提供更详细的错误信息
            let errorMessage = '图片压缩失败：';
            if (error.message === '压缩超时') {
                errorMessage += '处理时间过长，请尝试压缩小一些的图片';
            } else if (error.message.includes('not supported')) {
                errorMessage += '浏览器不支持该图片格式';
            } else {
                errorMessage += '请确保图片格式正确并重试';
            }
            
            alert(errorMessage);
            
            // 在压缩失败时使用原图
            compressedFile = file;
            compressedPreview.src = URL.createObjectURL(file);
            compressedSize.textContent = `文件大小：${formatFileSize(file.size)} (原始大小)`;
        }
    }

    // 下载压缩后的图片
    downloadBtn.addEventListener('click', () => {
        if (!compressedFile) return;
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(compressedFile);
        link.download = `compressed_${originalFile.name}`;
        link.click();
    });

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
} 