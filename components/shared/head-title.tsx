'use client';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

interface Props {
  className?: string;
}

export const HeadTitle: React.FC<Props> = ({ className }) => {
  const pathname = usePathname();
  return (
    <div className=" py-3 rounded-sm">
      <div className="relative flex items-center justify-center w-full">
        <Link
          href="/"
          className={cn(
            'absolute left-2 flex items-center p-2 transition-all duration-300',
            pathname === '/new-filter'
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-3 pointer-events-none',
          )}>
          <ArrowLeft />
        </Link>

        {/* Центр */}
        <div className="text-center flex flex-col items-center">
          <h3 className="text-[14px] font-bold leading-3 mb-2">MyPropertyBot</h3>
          <p className="font-light leading-2 text-[10px]">мини-приложение</p>
        </div>
      </div>
    </div>
  );
};
