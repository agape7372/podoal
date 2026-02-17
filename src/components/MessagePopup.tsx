'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import Avatar from './Avatar';

export default function MessagePopup() {
  const popupMessage = useAppStore((s) => s.popupMessage);
  const hidePopup = useAppStore((s) => s.hidePopup);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (popupMessage) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(hidePopup, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [popupMessage, hidePopup]);

  if (!popupMessage) return null;

  return (
    <div className={`fixed top-4 left-4 right-4 z-[100] ${visible ? 'popup-enter' : 'opacity-0 transition-opacity duration-300'}`}>
      <div className="max-w-lg mx-auto clay-float p-4 bg-gradient-to-br from-white to-clay-lavender/30">
        <div className="flex items-start gap-3">
          <Avatar avatar={popupMessage.sender.avatar} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-grape-700">
              {popupMessage.sender.name}
            </p>
            <p className="text-warm-text mt-0.5 text-sm">
              <span className="mr-1">{popupMessage.emoji}</span>
              {popupMessage.content}
            </p>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(hidePopup, 300); }}
            className="text-warm-light text-lg leading-none p-1"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
