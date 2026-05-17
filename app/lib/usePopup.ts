'use client';

import { useState } from 'react';

export function usePopup() {
  const [showCopiedPopup, setShowCopiedPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [popupDuration, setPopupDuration] = useState(2000);

  const showPopup = (message: string, durationMs = 2000) => {
    setPopupMessage(message);
    setPopupDuration(durationMs);
    setShowCopiedPopup(true);
    setTimeout(() => setShowCopiedPopup(false), durationMs);
  };

  return {
    showCopiedPopup,
    popupMessage,
    popupDuration,
    showPopup
  };
}
