import React from 'react';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { Filter } from './filters';

interface Props {
  className?: string;
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}

export const SquareInput: React.FC<Props> = ({ filters, setFilters, className }) => {
  return (
    <div className={cn(className, 'mt-3')}>
      <h3 className="font-medium mb-2">Площадь (м)</h3>
      <Input
        value={filters.areaMin ?? ''}
        onChange={(e) => setFilters({ ...filters, areaMin: Number(e.target.value) })}
        placeholder="От"
        className="h-10 mb-3 rounded-full  border-2"
      />
      <Input
        value={filters.areaMax ?? ''}
        onChange={(e) => setFilters({ ...filters, areaMax: Number(e.target.value) })}
        placeholder="До"
        className="h-10 rounded-full border-2"
      />
    </div>
  );
};
