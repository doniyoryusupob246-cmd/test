'use client';
import React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { Filter } from './filters';

interface Props {
  className?: string;
  filters: Filter;
  setFilters: React.Dispatch<React.SetStateAction<Filter>>;
}
const rooms = ['1', '2', '3', '4', '5+'];

export const RoomsSelect: React.FC<Props> = ({ filters, setFilters, className }) => {
  const toggleRoom = (room: string) => {
    const currentRoom = filters.rooms || [];

    const updateRooms = currentRoom.includes(room)
      ? currentRoom.filter((r) => r !== room)
      : [...currentRoom, room];

    setFilters({ ...filters, rooms: updateRooms });
  };
  return (
    <div className={cn(className)}>
      <h3 className="font-medium">Комнаты</h3>
      <div className="flex justify-between mt-2">
        {rooms.map((room) => (
          <Button
            onClick={() => toggleRoom(room)}
            key={room}
            variant={filters.rooms?.includes(room) ? 'default' : 'outline'}
            className="w-12.5 h-12.5">
            {room}
          </Button>
        ))}
      </div>
    </div>
  );
};
