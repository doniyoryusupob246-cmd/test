import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { cn } from '@/lib/utils';
import { Filter } from './filters';

interface Props {
  className?: string;
  items: string[];
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}

export const SelectDistrict: React.FC<Props> = ({ filters, setFilters, items, className }) => {
  return (
    <div className={cn(className, 'flex justify-between items-center max-w-107.5 w-full mt-10')}>
      <h3 className="font-medium">Район</h3>
      <Select
        value={filters.district}
        onValueChange={(value) => setFilters({ ...filters, district: value })}>
        <SelectTrigger className="w-70 rounded-full border-2">
          <SelectValue placeholder="Выберите район" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};
