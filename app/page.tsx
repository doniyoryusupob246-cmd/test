import { FiltersBlock } from '@/components/shared/filters-block';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="px-3">
      <Link
        href="/new-filter"
        className="bg-black text-white fixed bottom-5 right-5 w-[50px] h-[50px] text-[30px] flex items-center justify-center rounded-full cursor-pointer z-50">
        +
      </Link>
      <div className="pb-24">
        <FiltersBlock />
      </div>
    </div>
  );
}
