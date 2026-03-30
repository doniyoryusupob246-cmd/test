'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Filters, Filter } from '@/components/shared/filters';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function EditFilterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [initialData, setInitialData] = React.useState<Filter | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Загружаем данные фильтра
  React.useEffect(() => {
    if (!id) return;
    fetch(`/api/filter/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.filter) {
          const c = typeof data.filter.criteria === 'string'
            ? JSON.parse(data.filter.criteria)
            : data.filter.criteria;
          setInitialData(c);
        } else {
          setError('Фильтр не найден');
        }
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [id]);

  // Сохраняем изменения
  const handleSave = async (filters: Filter, name: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/filter/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: filters.type, criteria: filters }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      router.push('/');
    } catch (e: any) {
      alert('❌ ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-400">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={() => router.push('/')}>Назад</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 pt-5">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-[16px] font-semibold">Редактировать фильтр</h1>
      </div>

      <Filters
        className="mb-12"
        initialData={initialData}
        mode="edit"
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
