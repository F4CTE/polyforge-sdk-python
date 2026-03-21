import { useParams } from 'react-router';

export function Component() {
  const { username } = useParams();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-pf-text-muted mt-2">User: {username}</p>
    </div>
  );
}
