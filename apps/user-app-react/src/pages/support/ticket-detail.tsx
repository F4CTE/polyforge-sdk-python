import { useParams } from 'react-router';

export function Component() {
  const { id } = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Ticket Detail</h1>
      <p className="text-pf-text-muted mt-2">Ticket ID: {id}</p>
    </div>
  );
}
