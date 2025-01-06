chrome.runtime.onInstalled.addListener(() => {
  console.log("Video Downloader extension installed.");
});

chrome.action.onClicked.addListener((tab) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['popup.js']
  });
});
