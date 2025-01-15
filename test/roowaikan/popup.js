// 构建Google搜索URL
function buildGoogleSearchUrl(keyword) {
    const searchQuery = encodeURIComponent(keyword);
    return `https://www.google.com/search?q=${searchQuery}`;
}

// 构建archive.today搜索URL
function buildArchiveSearchUrl(url) {
    return `https://archive.today/search/?q=${encodeURIComponent(url)}`;
}

// 读取剪贴板内容
async function getClipboardContent() {
    try {
        const text = await navigator.clipboard.readText();
        return text;
    } catch (error) {
        console.error('Failed to read clipboard content:', error);
        return null;
    }
}

// 计算相关性分数
function calculateRelevanceScore(title, description, keyword) {
    const lowerTitle = title.toLowerCase();
    const lowerDesc = description.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();

    let score = 0;

    // 完全匹配得分更高
    if (lowerTitle.includes(lowerKeyword)) {
        score += 3;
    }
    if (lowerDesc.includes(lowerKeyword)) {
        score += 2;
    }

    // 多关键词匹配
    const keywords = lowerKeyword.split(' ');
    if (keywords.length > 1) {
        keywords.forEach(k => {
            if (lowerTitle.includes(k)) score += 1;
            if (lowerDesc.includes(k)) score += 0.5;
        });
    }

    return score;
}

// 显示结果
function showResult(message) {
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = message;
}

// 检查页面是否加载完成
function isPageLoaded() {
    return document.readyState === 'complete';
}

// 提取搜索结果
async function extractSearchResults(tabId, keyword) {
    try {
        // 等待页面加载完成
        await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                return new Promise(resolve => {
                    const checkInterval = setInterval(() => {
                        if (document.readyState === 'complete') {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    }, 100);
                });
            }
        });

        // 提取搜索结果
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (keyword) => {
                const results = [];
                const elements = document.querySelectorAll('.g');

                console.log('Found elements:', elements.length);

                elements.forEach(el => {
                    try {
                        const titleElement = el.querySelector('h3') || el.querySelector('.LC20lb');
                        const linkElement = el.querySelector('a');
                        const descElement = el.querySelector('.IsZvec, .VwiC3b, .MUxGbd');

                        if (titleElement && linkElement) {
                            const result = {
                                title: titleElement.innerText,
                                url: linkElement.href,
                                description: descElement ? descElement.innerText : ''
                            };

                            console.log('Found result:', result);
                            results.push(result);
                        }
                    } catch (error) {
                        console.error('Error parsing result:', error);
                    }
                });

                // 计算相关性分数
                results.forEach(result => {
                    result.score = calculateRelevanceScore(result.title, result.description, keyword);
                });

                // 按分数排序
                results.sort((a, b) => b.score - a.score);

                return results.slice(0, 5);
            },
            args: [keyword]
        });

        return results && results[0] ? results[0].result : null;
    } catch (error) {
        console.error('Failed to extract results:', error);
        return null;
    }
}

// 处理搜索
async function handleSearch() {
    const keyword = document.getElementById('searchInput').value;
    if (!keyword) {
        showResult('Please enter a search keyword.');
        return;
    }

    const searchUrl = buildGoogleSearchUrl(keyword);
    showResult('Searching...');

    try {
        // 打开Google搜索页面
        const tab = await chrome.tabs.create({ url: searchUrl, active: false });

        // 提取搜索结果
        const results = await extractSearchResults(tab.id, keyword);

        if (results && results.length > 0) {
            const bestMatch = results[0];
            const archiveUrl = buildArchiveSearchUrl(bestMatch.url);
            chrome.tabs.create({ url: archiveUrl });
            showResult(`Found: ${bestMatch.title}`);
        } else {
            showResult('No results found.');
        }
    } catch (error) {
        console.error('Search failed:', error);
        showResult('Search failed. Please try again.');
    }
}

// 绑定事件
document.getElementById('searchButton').addEventListener('click', handleSearch);
document.getElementById('pasteButton').addEventListener('click', async () => {
    const text = await getClipboardContent();
    if (text) {
        document.getElementById('searchInput').value = text;
        handleSearch();
    } else {
        showResult('Failed to read clipboard content.');
    }
});