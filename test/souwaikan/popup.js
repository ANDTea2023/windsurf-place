document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const getClipboardButton = document.getElementById('getClipboard');
    const resultDiv = document.getElementById('result');

    // 构建Google搜索URL的函数
    function buildGoogleSearchUrl(keyword) {
        const searchQuery = encodeURIComponent(`${keyword} (site:nytimes.com OR site:wsj.com OR site:economist.com)`);
        return `https://www.google.com/search?q=${searchQuery}`;
    }

    // 构建archive.today搜索URL的函数
    function buildArchiveSearchUrl(url) {
        return `https://archive.today/search/?q=${encodeURIComponent(url)}`;
    }

    // 获取剪贴板内容
    async function getClipboardText() {
        try {
            const text = await navigator.clipboard.readText();
            searchInput.value = text;
            resultDiv.textContent = '已获取剪贴板内容';
        } catch (err) {
            resultDiv.textContent = '无法读取剪贴板内容: ' + err.message;
            console.error('Failed to read clipboard:', err);
        }
    }

    // 从Google搜索结果页面提取相关链接
    async function extractRelevantLinks(tab) {
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // 查找所有链接
                    const links = [];
                    const allLinks = document.querySelectorAll('a');
                    
                    for (const a of allLinks) {
                        const href = a.href;
                        // 检查是否是目标网站的链接
                        if ((href.includes('nytimes.com') || 
                             href.includes('wsj.com') || 
                             href.includes('economist.com')) &&
                             !href.includes('google.com')) {
                            
                            // 查找标题和摘要
                            let title = '';
                            let snippet = '';
                            
                            // 尝试找到标题
                            const h3 = a.querySelector('h3');
                            if (h3) {
                                title = h3.textContent;
                            } else {
                                title = a.textContent;
                            }
                            
                            // 尝试找到摘要
                            const parentDiv = a.closest('div');
                            if (parentDiv) {
                                const snippetDiv = parentDiv.querySelector('div:not(:first-child)');
                                if (snippetDiv) {
                                    snippet = snippetDiv.textContent;
                                } else {
                                    snippet = parentDiv.textContent;
                                }
                            }
                            
                            if (href && title) {
                                links.push({
                                    link: href,
                                    title: title.trim(),
                                    snippet: snippet.trim()
                                });
                            }
                        }
                    }
                    
                    return links.slice(0, 15); // 返回前15个结果
                }
            });
            
            // 检查结果是否有效
            if (!result || !Array.isArray(result) || result.length === 0 || !result[0].result) {
                return [];
            }
            
            return result[0].result;
        } catch (error) {
            console.error('Error extracting links:', error);
            return [];
        }
    }

    // 计算文本相关性得分
    function calculateRelevanceScore(text, keywords) {
        if (!text || !keywords) return 0;
        
        const normalizedText = text.toLowerCase();
        const keywordList = keywords.toLowerCase().split(/\s+/);
        let score = 0;
        
        for (const keyword of keywordList) {
            if (keyword && normalizedText.includes(keyword)) {
                score += 1;
                // 完整短语匹配得分更高
                if (normalizedText.includes(keywords.toLowerCase())) {
                    score += 2;
                }
            }
        }
        return score;
    }

    // 执行搜索流程
    async function performSearch() {
        const keyword = searchInput.value.trim();
        if (!keyword) {
            resultDiv.textContent = '请输入搜索关键词';
            return;
        }

        resultDiv.textContent = '正在搜索...';

        try {
            // 打开Google搜索结果
            const googleSearchUrl = buildGoogleSearchUrl(keyword);
            const googleTab = await chrome.tabs.create({ url: googleSearchUrl, active: false });

            // 等待页面加载完成
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 提取相关链接
            const links = await extractRelevantLinks(googleTab);

            // 关闭Google搜索标签页
            chrome.tabs.remove(googleTab.id);

            if (!links || links.length === 0) {
                resultDiv.textContent = '未找到相关文章';
                return;
            }

            // 找出最相关的文章
            let bestMatch = null;
            let bestScore = -1;

            for (const item of links) {
                if (!item || !item.title || !item.link) continue;
                
                const score = calculateRelevanceScore(
                    (item.title + ' ' + (item.snippet || '')).trim(),
                    keyword
                );
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                }
            }

            if (!bestMatch) {
                resultDiv.textContent = '未找到相关文章';
                return;
            }

            // 使用archive.today搜索最相关的链接
            const archiveUrl = buildArchiveSearchUrl(bestMatch.link);
            chrome.tabs.create({ url: archiveUrl });

            // 显示结果
            resultDiv.innerHTML = `
                <div class="search-result">
                    <p><strong>找到最相关的文章：</strong></p>
                    <p><a href="${bestMatch.link}" target="_blank">${bestMatch.title}</a></p>
                    ${bestMatch.snippet ? `<p>${bestMatch.snippet}</p>` : ''}
                </div>
            `;

        } catch (error) {
            resultDiv.textContent = '搜索过程中出现错误: ' + error.message;
            console.error('Search error:', error);
        }
    }

    // 绑定按钮点击事件
    searchButton.addEventListener('click', performSearch);
    getClipboardButton.addEventListener('click', getClipboardText);

    // 绑定回车键搜索
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
});