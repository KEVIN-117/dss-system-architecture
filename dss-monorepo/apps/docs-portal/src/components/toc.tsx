'use client';

import { useEffect, useState } from 'react';

export type TocItem = { id: string; text: string; depth: 2 | 3 };

/** "En esta página" rail that highlights the section currently in view. */
export default function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    if (!targets.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;
  return (
    <nav className="dp-toc" aria-label="En esta página">
      <p className="dp-toc-title">En esta página</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? 'dp-toc-nested' : undefined}>
            <a href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
