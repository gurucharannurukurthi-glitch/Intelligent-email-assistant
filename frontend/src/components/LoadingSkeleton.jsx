import React from 'react';

export function EmailListSkeleton({ count = 8 }) {
  return (
    <div className="divide-y theme-border animate-pulse w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-3.5 theme-card/50">
          <div className="w-4 h-4 rounded theme-input shrink-0"></div>
          <div className="w-4 h-4 rounded-full theme-input shrink-0"></div>
          <div className="w-24 sm:w-36 h-3.5 rounded theme-input shrink-0"></div>
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="w-4/5 h-3.5 rounded theme-input"></div>
            <div className="w-3/5 h-2.5 rounded theme-input hidden sm:block"></div>
          </div>
          <div className="w-12 sm:w-16 h-3 rounded theme-input shrink-0"></div>
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-5 animate-pulse w-full max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl theme-input shrink-0"></div>
        <div className="w-2/3 h-6 rounded-xl theme-input"></div>
      </div>
      <div className="p-4 sm:p-5 rounded-2xl theme-card border theme-border space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full theme-input shrink-0"></div>
            <div className="space-y-1.5">
              <div className="w-36 sm:w-48 h-3.5 rounded theme-input"></div>
              <div className="w-24 sm:w-32 h-2.5 rounded theme-input"></div>
            </div>
          </div>
          <div className="w-20 h-3 rounded theme-input"></div>
        </div>
        <div className="space-y-2 pt-2 border-t theme-border">
          <div className="w-full h-3 rounded theme-input"></div>
          <div className="w-full h-3 rounded theme-input"></div>
          <div className="w-4/5 h-3 rounded theme-input"></div>
          <div className="w-3/5 h-3 rounded theme-input"></div>
        </div>
      </div>
    </div>
  );
}

export function ActionCenterSkeleton() {
  return (
    <div className="space-y-3 animate-pulse w-full">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 sm:p-4.5 rounded-2xl theme-card border theme-border space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-5 h-5 rounded-lg theme-input shrink-0"></div>
              <div className="w-2/3 h-4 rounded theme-input"></div>
            </div>
            <div className="w-16 h-4 rounded-full theme-input shrink-0"></div>
          </div>
          <div className="w-4/5 h-3 rounded theme-input pl-7"></div>
        </div>
      ))}
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div className="space-y-3 animate-pulse w-full">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl theme-card border theme-border space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-7 h-7 rounded-full theme-input shrink-0"></div>
              <div className="w-1/2 h-3.5 rounded theme-input"></div>
            </div>
            <div className="w-20 h-4 rounded-full theme-input shrink-0"></div>
          </div>
          <div className="space-y-1.5 pl-0 sm:pl-9">
            <div className="w-full h-3 rounded theme-input"></div>
            <div className="w-3/4 h-3 rounded theme-input"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
