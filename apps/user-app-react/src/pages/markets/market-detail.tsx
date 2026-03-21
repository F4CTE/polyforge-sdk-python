import { useParams } from 'react-router';

export function Component() {
  const { id } = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Market Detail</h1>
      <p className="text-pf-text-muted mt-2">Market ID: {id}</p>
    </div>
  );
}
