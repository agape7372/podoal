'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import ClayButton from '@/components/ClayButton';
import EmojiIcon from '@/components/EmojiIcon';
import { TEMPLATE_CATEGORIES, getTemplatesByCategory } from '@/lib/templates';
import type { HabitTemplate } from '@/lib/templates';

interface TemplatePickerProps {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  onSelectTemplate: (t: HabitTemplate) => void;
  onSkip: () => void;
}

/**
 * 포도판/포도동 만들기 공용 — 카테고리 가로 스크롤(양끝 페이드 힌트) + 템플릿 그리드 + "직접 입력".
 * board/create 와 relay/create 가 동일 흐름을 쓰도록 추출했다.
 */
export default function TemplatePicker({
  selectedCategory,
  onSelectCategory,
  onSelectTemplate,
  onSkip,
}: TemplatePickerProps) {
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [catEdges, setCatEdges] = useState({ left: false, right: false });
  const updateCatEdges = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    setCatEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => {
    updateCatEdges();
    window.addEventListener('resize', updateCatEdges);
    return () => window.removeEventListener('resize', updateCatEdges);
  }, [updateCatEdges]);

  const templates = getTemplatesByCategory(selectedCategory);

  return (
    <div className="space-y-5 animate-fade-in">
      <p className="text-sm text-warm-sub">템플릿으로 시작하거나 직접 만들어보세요!</p>

      {/* Category tabs — scroll-aware edge fades hint "there's more". */}
      <div className="relative -mx-1">
        <div
          ref={catScrollRef}
          onScroll={updateCatEdges}
          className="flex gap-2 py-2 px-1 overflow-x-auto scrollbar-hide"
        >
          {TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`
                clay-button px-3 py-2 rounded-xl text-sm whitespace-nowrap shrink-0
                ${selectedCategory === cat.id ? 'ring-2 ring-grape-400 clay-pressed bg-grape-50' : ''}
              `}
            >
              <span className="inline-flex items-center gap-1"><EmojiIcon emoji={cat.icon} size={15} /> {cat.name}</span>
            </button>
          ))}
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-white to-transparent transition-opacity duration-200 ${catEdges.left ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-white to-transparent transition-opacity duration-200 ${catEdges.right ? 'opacity-100' : 'opacity-0'}`}
        />
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template)}
            className="clay p-4 text-left transition-[transform,background-color] active:scale-[0.97] hover:bg-grape-50/40"
          >
            <div className="mb-2"><EmojiIcon emoji={template.icon} size={26} /></div>
            <p className="font-semibold text-sm text-grape-700 mb-1">{template.name}</p>
            <p className="text-xs text-warm-sub line-clamp-2">{template.description}</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="text-xs text-grape-600 tabular-nums">{template.suggestedSize}알</span>
            </div>
          </button>
        ))}
      </div>

      {/* Skip to custom */}
      <div className="pt-2">
        <ClayButton variant="secondary" fullWidth size="lg" onClick={onSkip}>
          직접 입력
        </ClayButton>
      </div>
    </div>
  );
}
