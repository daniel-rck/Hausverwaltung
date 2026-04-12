import { useProperty } from '../../hooks/useProperty';

export function PropertySelector() {
  const { properties, activeProperty, setActivePropertyId, addProperty } =
    useProperty();

  const handleAddProperty = async () => {
    await addProperty({ name: 'Neues Objekt', address: '', units: 0 });
  };

  return (
    <div className="flex items-center gap-3">
      {properties.length > 0 && (
        <select
          value={activeProperty?.id ?? ''}
          onChange={(e) => setActivePropertyId(Number(e.target.value))}
          className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-400"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={handleAddProperty}
        className="text-sm px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
      >
        + Objekt
      </button>
    </div>
  );
}
