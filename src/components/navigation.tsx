import Link from 'next/link';
import { Globe2, MapPin, Building2, Flag } from 'lucide-react';
export function Navigation({ active }: { active: string }) {
  const links = [
    { key: 'brasil', href: '/', label: 'Brasil', icon: Flag },
    { key: 'estados', href: '/estados', label: 'Estados', icon: MapPin },
    { key: 'municipios', href: '/municipios', label: 'Municípios', icon: Building2 },
    { key: 'exterior', href: '/exterior', label: 'Exterior', icon: Globe2 },
  ];
  return (
    <nav className="main-nav" aria-label="Abrangência da apuração">
      {links.map(({ key, href, label, icon: Icon }) => (
        <Link key={key} href={href} aria-current={active === key ? 'page' : undefined}>
          <Icon size={17} aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
