import React from 'react';
import { RangeSlider } from './range-slider';
import { cn } from '@/lib/utils';
import { Filter } from './filters';

interface Props {
  className?: string;
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}

export const Price: React.FC<Props> = ({ filters, setFilters, className }) => {
  return (
    <div className={cn(className, 'mt-10 w-full pb-7')}>
      <div className="mb-4">
        <h3 className="font-medium">Цена ($)</h3>
      </div>

      <div className="w-[80%] mx-auto">
        <RangeSlider
          min={0}
          max={1000}
          step={10}
          onValueChange={(value) =>
            setFilters({ ...filters, priceMin: value[0], priceMax: value[1] })
          }
          value={[filters.priceMin ?? 0, filters.priceMax ?? 1000]}
        />
      </div>
    </div>
  );
};
