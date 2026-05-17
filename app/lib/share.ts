/**
 * Share a URL via native share (mobile) or copy to clipboard (desktop).
 */
export async function shareToClipboard(shareUrl: string, showPopup: (msg: string) => void) {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Mobile native share
  if (navigator.share && isMobile) {
    try {
      navigator.share({ url: shareUrl });
      return;
    } catch (_shareErr) {
      // Fall through to clipboard methods
    }
  }

  // Method 1: Clipboard API
  let success = false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      success = true;
      showPopup("Copied to clipboard!");
    } catch (clipboardErr) {
      // Fall through
    }
  }

  // Method 2: Legacy clipboard
  if (!success) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        success = true;
        showPopup("Copied to clipboard!");
      }
    } catch (fallbackErr) {
      // Fall through
    }
  }

  // Method 3: Alert fallback
  if (!success) {
    alert(`Copy this link to share:\n${shareUrl}`);
  }
}
