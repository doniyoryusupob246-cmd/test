import React from 'react';
import { Button } from '../ui/button';
import { Filter } from './filters';
interface Props {
  className?: string;
  items: string[];
  title: string;
  filterKey: string;
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}

export const SelectVariants: React.FC<Props> = ({
  filterKey,
  filters,
  setFilters,
  className,
  items,
  title,
}) => {
  const toggle = (item: string) => {
    const selectedItems: string[] = (filters?.[filterKey as keyof Filter] as string[]) || [];
    const newActive = selectedItems.includes(item)
      ? selectedItems.filter((a: string) => a !== item)
      : [...selectedItems, item];
    setFilters({ ...filters, [filterKey!]: newActive });
  };
  return (
    <div className="mt-3">
      <h3 className="font-medium mb-2">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {items.map((item, i) => (
          <Button
            onClick={() => toggle(item)}
            key={item}
            variant={
              ((filters?.[filterKey as keyof Filter] as string[]) || []).includes(item)
                ? 'default'
                : 'outline'
            }
            className="h-[50px] border-2">
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
};
