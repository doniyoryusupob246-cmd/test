import React from 'react';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import { Filter } from './filters';

interface Props {
  className?: string;
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}

export const TypeRent: React.FC<Props> = ({ filters, setFilters, className }) => {
  return (
    <div className={className}>
      <RadioGroup className="flex gap-5 justify-center mt-8" defaultValue="Аренда квартир">
        <div
          onClick={() => setFilters({ ...filters, type: 'rent' })}
          className="flex items-center gap-3">
          <RadioGroupItem value="Аренда квартир" id="Аренда квартир" />
          <Label htmlFor="Аренда квартир">Аренда квартир</Label>
        </div>
        <div
          onClick={() => setFilters({ ...filters, type: 'sale' })}
          className="flex items-center gap-3">
          <RadioGroupItem value="Аренда домов" id="Аренда домов" />
          <Label htmlFor="Аренда домов">Аренда домов</Label>
        </div>
      </RadioGroup>
    </div>
  );
};
