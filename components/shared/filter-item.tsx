'use client';
import { cn } from '@/lib/utils';
import React from 'react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Filter } from '@prisma/client';
import Link from 'next/link';

interface Props {
  className?: string;
  filter: Filter;
  onDelete: (id: number) => void;
  onToggle: (id: number, isActive: boolean) => void;
}

export const FilterItem: React.FC<Props> = ({ onDelete, onToggle, className, filter }) => {
  const [loadingToggle, setLoadingToggle] = React.useState(false);
  const [loadingDelete, setLoadingDelete] = React.useState(false);

  const criteria = typeof filter.criteria === 'string'
    ? JSON.parse(filter.criteria)
    : (filter.criteria as any);

  // Форматируем детали фильтра
  const details: string[] = [];
  if (criteria?.district) details.push(criteria.district);
  if (criteria?.priceMin || criteria?.priceMax) {
    const min = criteria.priceMin ? `${criteria.priceMin.toLocaleString()}` : '0';
    const max = criteria.priceMax ? `${criteria.priceMax.toLocaleString()}` : '∞';
    details.push(`${min} — ${max} сум`);
  }
  if (criteria?.rooms?.length) {
    details.push(`${criteria.rooms.join(', ')} комн.`);
  }

  // Toggle активности
  const handleToggle = async (checked: boolean) => {
    setLoadingToggle(true);
    try {
      const res = await fetch(`/api/filter/${filter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      if (res.ok) {
        onToggle(filter.id, checked);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingToggle(false);
    }
  };

  // Удаление
  const handleDelete = async () => {
    if (!confirm('Удалить фильтр?')) return;
    setLoadingDelete(true);
    try {
      const res = await fetch(`/api/filter/${filter.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDelete(filter.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className={cn(
      'rounded-xl shadow-md w-full py-3 px-3 mb-3 transition-opacity',
      filter.isActive ? 'bg-white' : 'bg-gray-100 opacity-70',
      className
    )}>
      {/* Заголовок */}
      <div className="flex items-center justify-between w-full mb-2">
        <h2 className="font-semibold text-[14px] truncate max-w-[60%]">{filter.name}</h2>
        <span className={cn(
          'inline-block px-2 py-0.5 text-[11px] text-white rounded-full',
          filter.type === 'rent' ? 'bg-blue-500' : 'bg-emerald-500'
        )}>
          {filter.type === 'rent' ? 'Аренда' : 'Продажа'}
        </span>
      </div>

      {/* Детали */}
      <div className="flex flex-col gap-0.5 mb-3">
        {details.map((d, i) => (
          <p key={i} className="text-[12px] text-gray-500">{d}</p>
        ))}
      </div>

      <hr className="mb-3" />

      {/* Действия */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Switch
            id={`filter-switch-${filter.id}`}
            checked={filter.isActive}
            disabled={loadingToggle}
            onCheckedChange={handleToggle}
          />
          <Label
            htmlFor={`filter-switch-${filter.id}`}
            className="text-[12px] cursor-pointer"
          >
            {filter.isActive ? 'Активен' : 'Остановлен'}
          </Label>
        </div>

        <div className="flex gap-2">
          <Link href={`/edit-filter/${filter.id}`}>
            <Button variant="outline" size="icon" className="w-9 h-9 cursor-pointer">
              <Pencil size={14} />
            </Button>
          </Link>
          <Button
            variant="destructive"
            size="icon"
            className="w-9 h-9 cursor-pointer"
            onClick={handleDelete}
            disabled={loadingDelete}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};
