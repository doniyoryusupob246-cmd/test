'use client';

import { FloorHouseInput } from '@/components/shared/floor-house-input';
import { FloorInput } from '@/components/shared/floor-input';
import { Price } from '@/components/shared/price';
import { RoomsSelect } from '@/components/shared/rooms-select';
import { SelectDistrict } from '@/components/shared/select-district';
import { SelectVariants } from '@/components/shared/select-variants';
import { SquareInput } from '@/components/shared/square-input';
import { TypeRent } from '@/components/shared/type-rent';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

export interface Filter {
  type: 'rent' | 'sale';
  district?: string;
  priceMin?: number;
  priceMax?: number;
  rooms?: string[];
  areaMin?: number;
  areaMax?: number;
  floorMin?: number;
  floorMax?: number;
  totalFloorsMainMin?: number;
  totalFloorsMainMax?: number;
  planning?: string[];
  renovation?: string[];
  bathroom?: string[];
  furniture?: string[];
}

interface Props {
  className?: string;
  mode?: 'create' | 'edit';
  initialData?: Filter | null;
  onSave?: (filters: Filter, name: string) => Promise<void>;
  saving?: boolean;
}

const plans = ['Смежная','Раздельная','Смежно-раздельная','Пентхаус','Многоуровневая','Студия','Общежитие'];
const repair = ['Авторский проект','Евроремонт','Средний','Требует ремонта','Черновая','Предчистовая'];
const districts = ['Алмазарский','Бектемирский','Мирабадский','Мирзо-Улугбекский','Сергелийский','Учтепинский','Чиланзарский','Шайхантахурский','Юнусабадский','Яккасарайский','Яшнабадский'];
const snoozel = ['Раздельный','Совмещённый','2+'];
const furniture = ['Да','Нет','Все'];

export const Filters: React.FC<Props> = ({
  className,
  mode = 'create',
  initialData,
  onSave,
  saving = false,
}) => {
  const router = useRouter();
  const [openSett, setOpenSett] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<Filter>(
    initialData || { type: 'rent', rooms: [], planning: [], renovation: [] }
  );

  // Если initialData изменился (при edit) — обновляем стейт
  React.useEffect(() => {
    if (initialData) setFilters(initialData);
  }, [initialData]);

  const handleSubmit = async () => {
    if (onSave) {
      // Режим редактирования — вызываем внешний onSave
      const name = `Поиск ${filters.district ? 'в ' + filters.district : 'в Ташкенте'}`;
      await onSave(filters, name);
      return;
    }

    // Режим создания
    setLoading(true);
    try {
      const tg = window.Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;

      const res = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user?.id,
          name: `Поиск ${filters.district ? 'в ' + filters.district : 'в Ташкенте'}`,
          type: filters.type,
          criteria: filters,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');

      tg?.showAlert('✅ Фильтр создан!');
      router.push('/');
    } catch (e: any) {
      alert('❌ ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const isLoading = loading || saving;

  return (
    <div className={cn(className, 'max-w-107.5 w-full h-full mx-auto px-4 pt-5')}>

      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-2">
        {mode === 'edit' && (
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="border rounded-full border-black py-1 px-4 text-center">
          <p className="text-[15px]">
            {mode === 'edit' ? 'Редактировать фильтр' : 'Создать фильтр'}
          </p>
        </div>
      </div>

      <div className="flex flex-col bg-black/2 py-5 rounded-sm mt-3 px-5">
        <TypeRent filters={filters} setFilters={setFilters} />
        <SelectDistrict filters={filters} setFilters={setFilters} items={districts} />
        <Price filters={filters} setFilters={setFilters} />
        <RoomsSelect filters={filters} setFilters={setFilters} />
        <SquareInput filters={filters} setFilters={setFilters} />
      </div>

      {/* Доп. параметры */}
      <div className={cn(
        'mt-4 px-4 pb-2 overflow-hidden transition-[max-height] duration-500 ease-in-out',
        openSett ? 'max-h-[2000px]' : 'max-h-0'
      )}>
        <FloorInput filters={filters} setFilters={setFilters} />
        <FloorHouseInput filters={filters} setFilters={setFilters} />
        <SelectVariants filters={filters} filterKey="planning" setFilters={setFilters} title="Планировка" items={plans} />
        <SelectVariants filters={filters} filterKey="renovation" setFilters={setFilters} title="Ремонт" items={repair} />
        <SelectVariants filters={filters} filterKey="bathroom" setFilters={setFilters} title="Санузел" items={snoozel} />
        <SelectVariants filters={filters} filterKey="furniture" setFilters={setFilters} title="Мебель" items={furniture} />
      </div>

      <div
        onClick={() => setOpenSett(!openSett)}
        className="flex items-center justify-center mb-3 mt-3 gap-2 cursor-pointer"
      >
        <p className="text-[12px]">Дополнительные параметры</p>
        <ChevronDown className={cn('transition-transform duration-300', openSett ? 'rotate-180' : 'rotate-0')} size={13} />
      </div>

      <div className="pb-4">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className={cn('w-full h-10 rounded-full transition-all', isLoading && 'opacity-50 cursor-not-allowed')}
        >
          {isLoading ? 'Сохранение...' : mode === 'edit' ? 'Сохранить изменения' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
};
