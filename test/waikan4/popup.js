// 构建Google搜索URL
function buildGoogleSearchUrl(keyword) {
    const searchQuery = encodeURIComponent(keyword);
    return `https://www.google.com/search?q=${searchQuery}`;
}

// 构建archive.today搜索URL
function buildArchiveSearchUrl(url) {
    return `https://archive.today/search/?q=${encodeURIComponent(url)}`;
}

// 获取剪贴板内容
async function getClipboardText() {
    try {
        const text = await navigator.clipboard.readText();
        return text;
    } catch (error) {
        console.error('无法读取剪贴板:', error);
        return null;
    }
}

// 提取Google搜索结果
function extractGoogleResults() {
    const results = [];
    const links = document.querySelectorAll('a[jsname="UWckNb"]');
    
    links.forEach(link => {
        const title = link.querySelector('h3')?.textContent;
        const url = link.href;
        if (title && url) {
            results.push({ title, url });
        }
    });

    return results.slice(0, 5); // 返回前5条结果
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    const pasteBtn = document.getElementById('paste-btn');
    const searchBtn = document.getElementById('search-btn');
    const resultsDiv = document.getElementById('results');

    // 粘贴按钮点击事件
    pasteBtn.addEventListener('click', async () => {
        const text = await getClipboardText();
        if (text) {
            searchInput.value = text;
        }
    });

    // 搜索按钮点击事件
    searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        const googleUrl = buildGoogleSearchUrl(query);
        
        // 在后台打开Google搜索页面
        chrome.tabs.create({ url: googleUrl, active: false }, (tab) => {
            // 等待页面加载
            setTimeout(async () => {
                try {
                    // 执行脚本提取结果
                    const [result] = await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: extractGoogleResults
                    });

                    if (result && result.result.length > 0) {
                        // 显示结果
                        resultsDiv.innerHTML = result.result.map(r => `
                            <div class="result-item">
                                <h4>${r.title}</h4>
                                <a href="${r.url}" target="_blank">${r.url}</a>
                            </div>
                        `).join('');

                        // 使用archive.today搜索第一个结果
                        const archiveUrl = buildArchiveSearchUrl(result.result[0].url);
                        chrome.tabs.create({ url: archiveUrl });
                    }
                } catch (error) {
                    console.error('搜索出错:', error);
                    resultsDiv.innerHTML = '<p>搜索失败，请重试</p>';
                }
            }, 3000); // 等待3秒
        });
    });
});