'use client';
import { cn } from '@/lib/utils';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Props {
  className?: string;
}

export const MenuBar: React.FC<Props> = ({ className }) => {
  const [isActive, setIsActive] = React.useState(0);
  const pathname = usePathname();
  const links = [
    { text: 'Создать фильтр', link: '/new-filter' },
    { text: 'Мои фильтры', link: '/' },
  ];

  return (
    <div
      className={cn(
        className,
        'flex justify-around items-center rounded-tl-xl overflow-hidden rounded-tr-xl w-[95%]  left-1/2 -translate-x-1/2 h-12.5 bg-black z-99 fixed bottom-0',
      )}>
      {links.map((link, i) => (
        <Link
          className={cn(
            pathname === link.link ? 'text-white bg-white/20' : 'text-white bg-black',
            ' h-full w-full flex items-center justify-center ',
          )}
          onClick={() => setIsActive(i)}
          key={i}
          href={link.link}>
          {link.text}
        </Link>
      ))}
    </div>
  );
};
