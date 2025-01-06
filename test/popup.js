document.getElementById('downloadBtn').addEventListener('click', () => {
  const url = document.getElementById('videoUrl').value;
  if (url) {
    chrome.downloads.download({
      url: url,
      filename: 'downloaded_video.mp4'
    }, (downloadId) => {
      console.log('Download started with ID:', downloadId);
    });
  } else {
    alert('Please enter a valid URL.');
  }
});
