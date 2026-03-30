'use client';

import React from 'react';
import { FilterItem } from './filter-item';
import { Filter } from '@prisma/client';
import { useTelegram } from '@/hooks/useTelegram';
import Link from 'next/link';

interface Props {
  className?: string;
}

export const FiltersBlock: React.FC<Props> = ({ className }) => {
  const [data, setData] = React.useState<Filter[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { user, isReady } = useTelegram();

  const getData = async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/filter?telegramId=${user.id}`);
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      const body = await res.json();
      setData(body.filters || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (user?.id) getData();
  }, [user?.id]);

  const handleDelete = (id: number) => {
    setData((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggle = (id: number, isActive: boolean) => {
    setData((prev) => prev.map((f) => f.id === id ? { ...f, isActive } : f));
  };

  if (!isReady || loading) {
    return (
      <div className="flex flex-col gap-3 pt-5">
        {[1,2,3].map(i => (
          <div key={i} className="rounded-xl bg-gray-100 animate-pulse h-[120px]" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-500 text-sm">❌ {error}</div>;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-gray-400 text-[14px]">У вас пока нет фильтров</p>
        <Link
          href="/new-filter"
          className="bg-black text-white text-[13px] px-5 py-2 rounded-full"
        >
          Создать первый фильтр
        </Link>
      </div>
    );
  }

  return (
    <div className={className}>
      <h1 className="text-[16px] font-semibold mb-4 pt-5">Мои фильтры</h1>
      {data.map((filter) => (
        <FilterItem
          key={filter.id}
          filter={filter}
          onDelete={handleDelete}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
};
