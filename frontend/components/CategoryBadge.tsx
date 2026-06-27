interface Props {
  nombre: string | null;
}

export function CategoryBadge({ nombre }: Props) {
  if (!nombre) return <span className="text-gray-400 text-xs">Sin categoría</span>;
  return (
    <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{nombre}</span>
  );
}
