'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import Avatar from './Avatar';
import EmojiIcon from './EmojiIcon';

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
    <div role="alert" aria-live="polite" className={`fixed top-4 left-4 right-4 z-100 ${visible ? 'popup-enter' : 'opacity-0 transition-opacity duration-300'}`}>
      <div className="max-w-lg mx-auto clay-float p-4">
        <div className="flex items-start gap-3">
          <Avatar avatar={popupMessage.sender.avatar} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm text-grape-700">
              {popupMessage.sender.name}
            </p>
            <p className="text-warm-text mt-0.5 text-sm">
              <EmojiIcon emoji={popupMessage.emoji} size={16} className="mr-1" />
              {popupMessage.content}
            </p>
          </div>
          <button
            onClick={() => { setVisible(false); setTimeout(hidePopup, 300); }}
            aria-label="닫기"
            className="text-warm-sub text-lg leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
