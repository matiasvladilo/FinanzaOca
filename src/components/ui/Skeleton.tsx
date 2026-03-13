'use client';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={'bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse ' + (className ?? '')} />
  );
}
