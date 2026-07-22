export interface User {
  id: string;
  name: string;
  archived: boolean;
}

const users = new Map<string, User>();
users.set('active-1', { id: 'active-1', name: 'Ada', archived: false });
users.set('archived-1', { id: 'archived-1', name: 'Bea', archived: true });

export function findVisibleUser(id: string): User | null {
  const user = users.get(id);
  if (!user) return null;
  if (user.archived) return null;
  return user;
}
