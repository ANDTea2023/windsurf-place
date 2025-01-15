// URL构建函数
function buildGoogleSearchUrl(keyword) {
    return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
}

function buildArchiveSearchUrl(url) {
    return `https://archive.today/search/?q=${encodeURIComponent(url)}`;
}

// 显示状态消息
function showStatus(message, isError = false) {
    console.log('Status:', message, isError ? '(error)' : '');
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.style.color = isError ? 'red' : 'black';
    }
}

// 显示搜索结果
function displayResults(results) {
    console.log('Displaying results:', results);
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) {
        console.error('Results div not found');
        return;
    }

    resultsDiv.innerHTML = '';
    
    results.forEach((result, index) => {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.textContent = `${index + 1}. ${result.title}`;
        
        const link = document.createElement('a');
        link.href = result.url;
        link.textContent = result.url;
        link.target = '_blank';
        
        const archiveLink = document.createElement('a');
        archiveLink.href = buildArchiveSearchUrl(result.url);
        archiveLink.textContent = '查看存档';
        archiveLink.target = '_blank';
        archiveLink.style.marginLeft = '10px';
        
        div.appendChild(title);
        div.appendChild(link);
        div.appendChild(archiveLink);
        resultsDiv.appendChild(div);
    });
}

// 执行搜索
async function doSearch(searchText) {
    let searchTab = null;
    try {
        showStatus('正在搜索...');

        // 创建新标签页进行搜索（不可见）
        searchTab = await chrome.tabs.create({
            url: buildGoogleSearchUrl(searchText),
            active: false
        });

        // 等待页面加载完成
        await new Promise(resolve => {
            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === searchTab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });

        // 等待一下确保内容加载完成
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 提取搜索结果
        const results = await extractSearchResults(searchTab.id, searchText);

        // 关闭搜索标签页
        if (searchTab) {
            await chrome.tabs.remove(searchTab.id);
        }

        if (results && results.length > 0) {
            // 在新窗口打开Google搜索结果页面
            window.open(buildGoogleSearchUrl(searchText), '_blank');

            // 获取最相关的结果（第一个结果）
            const mostRelevantUrl = results[0].url;
            console.log('Most relevant URL:', mostRelevantUrl);

            // 在新窗口打开archive链接
            window.open(buildArchiveSearchUrl(mostRelevantUrl), '_blank');

            // 显示所有结果
            displayResults(results);
            showStatus('搜索完成');
        } else {
            showStatus('未找到结果', true);
        }
    } catch (error) {
        console.error('Search error:', error);
        showStatus('搜索出错: ' + error.message, true);
        if (searchTab) {
            try {
                await chrome.tabs.remove(searchTab.id);
            } catch (e) {
                console.error('关闭标签页失败:', e);
            }
        }
    }
}

// 提取搜索结果
async function extractSearchResults(tabId, searchText) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: (searchText) => {
                function getTextContent(element) {
                    return element ? element.textContent.trim() : '';
                }

                function calculateRelevance(title, snippet, searchText) {
                    const searchTerms = searchText.toLowerCase().split(/\s+/);
                    let score = 0;
                    
                    // 标题相关性评分
                    const titleLower = title.toLowerCase();
                    searchTerms.forEach(term => {
                        if (titleLower.includes(term)) {
                            score += 10; // 标题中包含搜索词，权重高
                            if (titleLower.startsWith(term)) {
                                score += 5; // 标题以搜索词开头，额外加分
                            }
                        }
                    });

                    // 摘要相关性评分
                    const snippetLower = snippet.toLowerCase();
                    searchTerms.forEach(term => {
                        if (snippetLower.includes(term)) {
                            score += 5; // 摘要中包含搜索词
                        }
                    });

                    // 计算搜索词在文本中的密度
                    const wordCount = snippet.split(/\s+/).length;
                    if (wordCount > 0) {
                        const termFrequency = searchTerms.reduce((count, term) => {
                            const regex = new RegExp(term, 'gi');
                            return count + (snippetLower.match(regex) || []).length;
                        }, 0);
                        score += (termFrequency / wordCount) * 20;
                    }

                    return score;
                }

                const results = [];
                const searchDiv = document.querySelector('#search');

                if (!searchDiv) {
                    return results;
                }

                // 查找所有搜索结果项
                const items = searchDiv.querySelectorAll('div.g');

                for (const item of items) {
                    try {
                        // 查找标题和链接
                        const titleElement = item.querySelector('h3');
                        const linkElement = item.querySelector('a');
                        const snippetElement = item.querySelector('div.VwiC3b');
                        
                        if (!titleElement || !linkElement) {
                            continue;
                        }

                        const title = getTextContent(titleElement);
                        const url = linkElement.href;
                        const snippet = snippetElement ? getTextContent(snippetElement) : '';

                        if (!url || url.includes('google.com')) {
                            continue;
                        }

                        // 计算相关性分数
                        const relevance = calculateRelevance(title, snippet, searchText);

                        results.push({
                            title,
                            url,
                            snippet,
                            relevance
                        });
                        
                        // 只获取前10个结果
                        if (results.length >= 10) {
                            break;
                        }
                    } catch (error) {
                        console.error('Error processing item:', error);
                    }
                }

                // 按相关性分数排序
                results.sort((a, b) => b.relevance - a.relevance);
                return results;
            },
            args: [searchText]
        });

        return results[0].result;
    } catch (error) {
        console.error('提取结果时出错:', error);
        showStatus('提取结果失败: ' + error.message, true);
        return [];
    }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing extension...');
    
    const searchInput = document.getElementById('searchInput');
    const pasteSearchBtn = document.getElementById('pasteSearchBtn');

    // 粘贴并搜索按钮点击事件
    pasteSearchBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            searchInput.value = text;
            doSearch(text);
        } catch (error) {
            console.error('粘贴失败:', error);
            showStatus('粘贴失败: ' + error.message, true);
        }
    });

    // 输入框回车事件
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
            doSearch(searchInput.value.trim());
        }
    });

    console.log('Initialization complete');
});
